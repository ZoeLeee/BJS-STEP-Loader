import {
  Scene,
  SceneLoader,
  ArcRotateCamera,
  FramingBehavior,
  AxesViewer,
  Vector3,
  StandardMaterial,
  Color3,
  Engine,
} from "@babylonjs/core";

import * as BABYLON from "@babylonjs/core";

import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders/OBJ";
import "./loaders/StepFileLoader";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";

// window["BABYLON"] = BABYLON;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const engine = new Engine(canvas);
engine.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene(engine);
// scene.useRightHandedSystem = true;
scene.createDefaultLight(true);

const camera = new ArcRotateCamera(
  "123",
  -(Math.PI / 2),
  Math.PI / 2,
  100,
  Vector3.Zero(),
  scene
);
camera.minZ = 0.1;
camera.maxZ = 1e7;
camera.attachControl();

// new AxesViewer(scene, 10);

function zoomAll(s = scene) {
  // s.createDefaultCamera(true);
  const c = s.activeCamera as ArcRotateCamera;
  console.log("camera: ", s.activeCamera === camera);

  // Enable camera's behaviors
  c.useFramingBehavior = true;

  const framingBehavior = c.getBehaviorByName("Framing") as FramingBehavior;
  framingBehavior.framingTime = 0;
  framingBehavior.elevationReturnTime = -1;

  console.log("s.meshes: ", s.meshes);
  if (s.meshes.length) {
    c.lowerRadiusLimit = null;

    const worldExtends = s.getWorldExtends(function (mesh) {
      return mesh.isVisible && mesh.isEnabled() && mesh.name !== "cylinder";
    });
    framingBehavior.zoomOnBoundingInfo(worldExtends.min, worldExtends.max);
  }

  // camera.useAutoRotationBehavior = true;
  c.pinchPrecision = 200 / c.radius;
  c.upperRadiusLimit = 10 * c.radius;
  c.lowerRadiusLimit = 0;
  // camera.wheelDeltaPercentage = 0.01;
  // camera.pinchDeltaPercentage = 0.01;
  c.useFramingBehavior = false;
}

window["zoomall"] = zoomAll;

// SceneLoader.AppendAsync("/static/models/", "02.STEP").then((scene) => {});
// SceneLoader.AppendAsync("/static/models/", "Xbot.glb").then((s) => {
//   console.log("s.material: ", s.materials);
//   s.materials.forEach(
//     (m) => ((m as StandardMaterial).diffuseColor = Color3.White())
//   );
//   setTimeout(() => {
//     zoomAll();
//   }, 1000);
// });
console.log(12);
// SceneLoader.AppendAsync("http://127.0.0.1:5000/", "download/01.gltf").then(
//   (s) => {
//     console.log("s.material: ", s.materials);
//     s.materials.forEach(
//       (m) => ((m as StandardMaterial).diffuseColor = Color3.White())
//     );
//     setTimeout(() => {
//       scene.skipFrustumClipping = true;
//       zoomAll(s);
//     }, 1000);
//   }
// );
// SceneLoader.AppendAsync("/static/models/", "AVG01.obj").then((s) => {
//   console.log("s.material: ", s.materials);
//   s.materials.forEach(
//     (m) => ((m as StandardMaterial).diffuseColor = Color3.White())
//   );
//   setTimeout(() => {
//     scene.skipFrustumClipping = true;
//     zoomAll(s);
//   }, 1000);
// });

function render() {
  engine.runRenderLoop(() => {
    scene.render();
  });
}

window["debug"] = () => {
  scene.debugLayer.show({
    embedMode: true,
    overlay: true,
    globalRoot: document.getElementById("app"),
  });
};

window.onresize = () => {
  engine.setSize(window.innerWidth, window.innerHeight);
};

window["debug"]();
render();

const btn = document.getElementById("btn");
const fileEl = document.getElementById("file") as HTMLInputElement;
const loading = document.getElementById("loading");
loading.style.display = "none";
fileEl.addEventListener("change", (e) => {
  const files = fileEl.files as FileList;
  if (files.length === 0) return;
  loading.style.display = "block";
  const formData = new FormData();
  //@ts-ignore
  formData.append("file", files[0]);
  console.log("files[0].size: ", files[0].size);
  if (files[0].size >= 40 * 1024 * 1024) {
    loading.innerText = "最大支持40M";
    setTimeout(() => {
      loading.style.display = "none";
    }, 3000);
    return;
  }
  loading.innerText = "正在上传，请稍后。。。。。";
  fetch("http://127.0.0.1:5000/upload", {
    method: "POST",
    mode: "cors",
    body: formData,
  })
    .then((res) => res.json())
    .then((res) => {
      console.log("res: ", res);
      loading.innerText = "上传解析成功，正在加载。。。。。";
      if (res.ok) {
        SceneLoader.AppendAsync("http://127.0.0.1:5000/", res.url).then((s) => {
          console.log("s.material: ", s.materials);
          s.materials.forEach(
            (m) => ((m as StandardMaterial).diffuseColor = Color3.White())
          );
          setTimeout(() => {
            loading.style.display = "none";
            scene.skipFrustumClipping = true;
            zoomAll(s);
          }, 1000);
        });
      }
    });
});
