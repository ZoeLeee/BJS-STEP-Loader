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
  Texture,
  MeshBuilder,
  TransformNode,
  PointerEventTypes,
  Effect,
  FilesInput,
  FilesInputStore,
  Mesh,
  FileToolsOptions,
} from "@babylonjs/core";
import { Helper } from "dxf";
import DxfParser from "dxf-parser";
import * as BABYLON from "@babylonjs/core";

import "@babylonjs/loaders/glTF";
import "@babylonjs/loaders/OBJ";
import "./loaders/StepFileLoader";
import "./loaders/hc3dFileLoader";
import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import renderDXF from "./renderDXF";

import JSZip from "jszip";
let t = Date.now();

FileToolsOptions.PreprocessUrl = (url: string) => {
  if(url.startsWith("data:")) return url
  url += `?t=${t++}`;
  return url;
};

// window["BABYLON"] = BABYLON;

Effect.ShadersStore["fogFxFragmentShader"] = `
    #ifdef GL_ES
        precision highp float;
    #endif

    // Samplers
    varying vec2 vUV;
    uniform sampler2D textureSampler;
	uniform sampler2D depthData;

	uniform vec3 cameraPos;
	uniform vec3 cameraDir;
	
	uniform vec2 uCameraDepths;
	uniform vec2 resolution;
	
	uniform mat4 world;
	uniform mat4 projection;
	uniform mat4 iprojection;
	uniform mat4 iview;

    uniform float maxZ;
		
	vec3 ssToWorldPos(){	
        float depthColor = texture2D(depthData, vUV).r;
        vec4 ndc = vec4(
                (vUV.x - 0.5) * 2.0,
                (vUV.y - 0.5) * 2.0,
                -projection[2].z + projection[3].z / (depthColor * maxZ),
                1.0
            );

        vec4 worldSpaceCoord = iview * iprojection * ndc;

        worldSpaceCoord /= worldSpaceCoord.w;

        vec3 dir = normalize(cameraDir + worldSpaceCoord.xyz);
        vec3 vectorToPixel = (dir * (depthColor * maxZ)) + cameraPos;
        return worldSpaceCoord.xyz;//vectorToPixel;
	}

    void main(void) 
    {
        vec4 baseColor = texture2D(textureSampler, vUV);				
        vec3 pixelPos = ssToWorldPos();

        if (pixelPos.x > 0.
            && pixelPos.x < 2.
            && pixelPos.z > -3.
            && pixelPos.z < 0.
            && pixelPos.y > -1.
            && pixelPos.y < 1.
        ) {
            baseColor = vec4(baseColor.x, 0., 0., 1.);
        }

        gl_FragColor = baseColor;  
    }
    `;

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const parser = new DxfParser();

const engine = new Engine(canvas);
engine.setSize(window.innerWidth, window.innerHeight);

const scene = new Scene(engine);
scene.useRightHandedSystem = true;
scene.createDefaultLight(true);
scene.clearColor = Color3.Black().toColor4();
const camera = new ArcRotateCamera(
  "123",
  -(Math.PI / 4),
  Math.PI / 4,
  1000,
  Vector3.Zero(),
  scene
);
camera.minZ = 0.1;
camera.maxZ = 10000;
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
// SceneLoader.AppendAsync("/static/models/", "dog.glb").then((s) => {
//   console.log("s.material: ", s.materials);
//   s.materials.forEach(
//     (m) => ((m as StandardMaterial).diffuseColor = Color3.White())
//   );
//   setTimeout(() => {
//     scene.skipFrustumClipping = true;
//     zoomAll(s);
//   }, 1000);
// });
// SceneLoader.AppendAsync("https://hc3d-core.histron.cn/editor/file/read/b5ee964a-ea22-449a-964c-3d4be334dbe2/The_attachment_machine01-touming.gltf").then((s) => {
//   console.log("s.material: ", s.materials);
//   // s.materials.forEach(
//   //   (m) => ((m as StandardMaterial).diffuseColor = Color3.White())
//   // );
//   // setTimeout(() => {
//   //   scene.skipFrustumClipping = true;
//   // }, 1000);
//     setTimeout(() => {
//     scene.skipFrustumClipping = true;
//     zoomAll(scene);
//   }, 1000);
// });

// SceneLoader.AppendAsync("/static/models/xbot/", "index.hc3d")
// Promise.all([SceneLoader.AppendAsync("/static/models/111/", "index.hc3d")]).then(res=>{
//   setTimeout(() => {
//     scene.skipFrustumClipping = true;
//     zoomAll(scene);
//   }, 1000);
// })

// MeshBuilder.CreateGround("test", { width: 100, height: 100 });

// var fog = new BABYLON.PostProcess(
//   "Fog FX",
//   "fogFx",
//   [
//     "cameraPos",
//     "cameraDir",
//     "uCameraDepths",
//     "resolution",
//     "world",
//     "iprojection",
//     "iview",
//     "projection",
//     "maxZ",
//   ],
//   ["depthData"],
//   1,
//   camera
// );

// var depth = scene.enableDepthRenderer(camera, false);

// fog.onApply = function (effect) {
//   effect.setVector2(
//     "resolution",
//     new BABYLON.Vector2(canvas.width, canvas.height)
//   );
//   effect.setVector2(
//     "uCameraDepths",
//     new BABYLON.Vector2(camera.minZ, camera.maxZ)
//   );

//   effect.setVector3("cameraPos", camera.position);
//   effect.setVector3("cameraDir", camera.getForwardRay(0).direction);

//   effect.setTexture("depthData", depth.getDepthMap());

//   effect.setMatrix("world", camera.getWorldMatrix());
//   // effect.setMatrix("projection", camera.getProjectionMatrix())
//   // effect.setMatrix("view", camera.getViewMatrix())

//   let iprojection = new BABYLON.Matrix();
//   camera.getProjectionMatrix().invertToRef(iprojection);
//   let iview = new BABYLON.Matrix();
//   camera.getViewMatrix().invertToRef(iview);
//   effect.setMatrix("iprojection", iprojection);
//   effect.setMatrix("iview", iview);
//   effect.setMatrix("projection", camera.getProjectionMatrix());

//   effect.setFloat("maxZ", camera.maxZ);
// };

// SceneLoader.AppendAsync("/static/models/xbot/", "index.hc3d")
// Promise.all([SceneLoader.AppendAsync("/static/models/111/", "index.hc3d")]).then(res=>{
//   setTimeout(() => {
//     scene.skipFrustumClipping = true;
//     zoomAll(scene);
//   }, 1000);
// })

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
new AxesViewer(scene);

window["debug"]();
render();
const btn = document.getElementById("btn");
const fileEl = document.getElementById("file") as HTMLInputElement;
const loading = document.getElementById("loading");
loading.style.display = "none";
fileEl.addEventListener("change", (e) => {
  const files = fileEl.files as FileList;
  if (files.length === 0) return;
  console.log(files[0].type);
  if (files[0].name.endsWith("dxf")) {
    const reader = new FileReader();
    reader.readAsText(files[0]);
    reader.onload = async (e) => {
      console.log(e);
      const result = e.target.result;
      loading.style.display = "block";
      loading.innerText = "正在解析。。。。。";
      console.time("2");
      const dxf = parser.parse(result as string);
      console.log("dxf: ", dxf);
      console.timeEnd("2");

      // const helper = new Helper(result);
      // console.log("helper: ", helper.parsed);
      // console.time("0");

      // const data = helper.toPolylines();
      // console.timeEnd("0");

      // console.log("data: ", data);
      engine.stopRenderLoop();
      console.time("加载图像");
      await renderDXF(dxf, scene);
      console.timeEnd("加载图像");
      loading.style.display = "none";
      render();
      return;
      setTimeout(() => {
        // zoomAll(scene)
      }, 1000);
      // console.time("0")

      // // The 1-to-1 object representation of the DXF
      // console.log("parsed:", helper.parsed);
      // console.timeEnd("0")

      // Denormalised blocks inserted with transforms applied
      // console.log("denormalised:", helper.denormalised);
      // Create an SVG
      // console.log("svg:", typeof helper.toSVG());

      // // Create polylines (e.g. to render in WebGL)

      // const texture = Texture.LoadFromDataString(
      //   "svg",
      //   "data:image/svg+xml;base64," + window.btoa(helper.toSVG()),
      //   scene
      // );
      // const mtl = new StandardMaterial("2222");
      // mtl.diffuseTexture = texture;
      // // const plane = MeshBuilder.CreateGround(
      // //   "123",
      // //   { width: 213, height: 150 },
      // //   scene
      // // );
      // // plane.material = mtl;
      // const root = new TransformNode("l-root");
      // const bbox = data.bbox;
      // const min = new Vector3(bbox.min.x, bbox.min.y);
      // const max = new Vector3(bbox.max.x, bbox.max.y);
      // const center = Vector3.Center(min, max);
      // let index = 0;
      // for (const l of data.polylines) {
      //   if (l.vertices.length === 0) continue;
      //   const color = new Color3(
      //     l.rgb[0] / 255,
      //     l.rgb[1] / 255,
      //     l.rgb[2] / 255
      //   );
      //   const line = MeshBuilder.CreateLines(
      //     (index++).toString(),
      //     {
      //       points: l.vertices.map((v) => new Vector3(v[0], v[1])),
      //     },
      //     scene
      //   );
      //   line.color = color;
      //   line.parent = root;
      // }
      // root.position = min.negate();
      // zoomAll(scene);
    };
    fileEl.value = "";
    return;
  }

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
        SceneLoader.AppendAsync(
          "http://127.0.0.1:5000/download/",
          res.url
        ).then((s) => {
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

scene.onPointerObservable.add((info) => {
  if (info.type === PointerEventTypes.POINTERDOWN) {
    console.log("info: ", info);
  }
});

const url=new URL(location.href)
SceneLoader.ShowLoadingScreen = false;
if(url.searchParams.get("type")==="zip"){
  for (let i = 0; i < 10; i++) loadZip();
}
else{
  for (let i = 0; i < 10; i++) loadGLTF();
}
btn.onclick = () => {
  for (let i = 0; i < 10; i++) loadZip();
};

SceneLoader.ShowLoadingScreen = false;
async function loadZip() {
  t++;
  const buffer = await fetch("/static/models/111.zip?t=" + t).then((res) =>
    res.arrayBuffer()
  );

  const uint8Array = new Uint8Array(buffer);

  // 加载 zip 包
  const zip = await JSZip.loadAsync(uint8Array);

  console.log("zip: ", zip);
  // 从 zip 包中提取 glTF 模型文件
  // zip.file('ship01.gltf').async('string').then((modelData) => {
  //   // 使用 Babylon.js 的加载器加载 glTF 模型文件
  //   BABYLON.SceneLoader.AppendAsync('', modelData, scene, (newMeshes) => {
  //     console.log('newMeshes: ', newMeshes);
  //     // 模型加载完成后的回调
  //     // 可以在这里进行其他操作，如添加光源和相机等
  //   }, null, null, '.gltf');
  // });
  const fileMap = {};

  const pendings = [];

  let gltf: File;

  for (const file in zip.files) {
    var entry = zip.file(file);

    if (entry === null) continue;

    pendings.push(
      entry.async("blob").then((blob) => {
        FilesInputStore.FilesToLoad[file.toLocaleLowerCase()] = new File(
          [blob],
          file
        );
        if (file.endsWith("gltf")) {
          gltf = FilesInputStore.FilesToLoad[file.toLocaleLowerCase()];
        }
      })
    );
  }
  await Promise.all(pendings);

  BABYLON.SceneLoader.AppendAsync("file:", gltf, scene).then((r) => {
    for (let i = 0; i < r.rootNodes.length; i++) {
      const node = r.rootNodes[i];
      if (node.name === "__root__") {
        node.position.z = i * 100;
      }
    }
  });
}

function loadGLTF() {
  t++;
  BABYLON.SceneLoader.AppendAsync(
    "/static/models/222/",
    `C.gltf?t=${t}`,
    scene
  ).then((r) => {
    for (let i = 0; i < r.rootNodes.length; i++) {
      const node = r.rootNodes[i];
      if (node.name === "__root__") {
        node.position.z = i * 100;
      }
    }
  });
}
