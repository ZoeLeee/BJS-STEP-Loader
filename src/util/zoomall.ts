import { ArcRotateCamera, FramingBehavior, Node, Scene } from "@babylonjs/core";

export function zoomAll(s: Scene, meshs?: Node[]) {
  // s.createDefaultCamera(true);
  const c = s.activeCamera as ArcRotateCamera;

  // Enable camera's behaviors
  c.useFramingBehavior = true;

  const framingBehavior = c.getBehaviorByName("Framing") as FramingBehavior;
  framingBehavior.framingTime = 0;
  framingBehavior.elevationReturnTime = -1;

  console.log("s.meshes: ", s.meshes);

  if (s.meshes.length) {
    c.lowerRadiusLimit = null;

    const worldExtends = s.getWorldExtends(function (mesh) {
      return (
        mesh.isVisible && mesh.isEnabled() && (!meshs || meshs.includes(mesh))
      );
    });
    console.log("worldExtends: ", worldExtends);
    framingBehavior.zoomOnBoundingInfo(worldExtends.min, worldExtends.max);
  }

  // camera.useAutoRotationBehavior = true;
  c.pinchPrecision = 200 / c.radius;
  //   c.upperRadiusLimit = 10 * c.radius;
  c.lowerRadiusLimit = 0;
  // camera.wheelDeltaPercentage = 0.01;
  // camera.pinchDeltaPercentage = 0.01;
  c.useFramingBehavior = false;
}
