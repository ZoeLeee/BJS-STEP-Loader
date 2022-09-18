import {
  ArcRotateCamera,
  CreateLineSystem,
  Matrix,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { IDxf, IEntity, IPoint } from "dxf-parser";
import { sleep } from "./utils/sleep";

const AsVector3 = (p) => {
  return new Vector3(p.x, p.y, p.z);
};
const YAxis = new Vector3(0, 1);
const ZAxis = new Vector3(0, 0, 1);
const ComputUpDirection = (
  n: Vector3,
  ay: Vector3 = new Vector3(),
  ax: Vector3 = new Vector3()
): Vector3 => {
  n.normalize();
  if (Math.abs(n.x) < 0.015625 && Math.abs(n.y) < 0.015625) {
    n.copyFrom(ax.cross(YAxis));
  } else n.copyFrom(ax.cross(ZAxis));

  ax.copyFrom(ay.cross(n));
  ax.normalize();
  ay.normalize();
  return ay;
};

const GetMatrix4 = (en: IEntity) => {
  let nor = new Vector3(0, 0, 1);
  if (en["extrusionDirection"])
    nor.copyFrom(AsVector3(en["extrusionDirection"]));
  else if (
    en["extrusionDirectionX"] !== undefined &&
    en["extrusionDirectionY"] !== undefined &&
    en["extrusionDirectionZ"] !== undefined
  )
    nor.set(
      en["extrusionDirectionX"],
      en["extrusionDirectionY"],
      en["extrusionDirectionZ"]
    );

  let x = new Vector3();
  let y = new Vector3();
  ComputUpDirection(nor, y, x);
  const mtx = new Matrix();
  Matrix.FromXYZAxesToRef(x, y, nor, mtx);
  return mtx;
};

function renderPloyline(en: IEntity) {
  console.log("polyline: ", en);
  const mtx = GetMatrix4(en);
  const nor = mtx.getRow(2).toVector3();
  const vertices = en["vertices"] as IPoint[];
  if (!vertices?.length) return [];
  const ps = vertices.map((v) => new Vector3(v.x, v.y, v.z));
  ps.forEach((p) => {
    if (en["elevation"]) {
      console.log(en["elevation"]);
    }
    Vector3.TransformCoordinatesToRef(p, mtx, p);
    p.addToRef(nor.scale(en["elevation"] ?? 0), p);
  });
  return ps;
}
function renderLine(en: IEntity) {
  console.log("line: ", en);
  const vertices = en["vertices"] as IPoint[];
  if (vertices?.length) {
    const ps = vertices.map((v) => new Vector3(v.x, v.y, v.z));
    return ps;
  }
  return [];
}

function drawEntity(en: IEntity) {
  switch (en.type) {
    case "Line":
      return renderLine(en);
    case "LWPOLYLINE":
      return renderPloyline(en);
    default:
      console.log(en.type);
      return [];
  }
}
async function drawEntitys(ens: IEntity[]) {
  let i = 0;
  const points: Vector3[][] = [];
  for (const en of ens) {
    points.push(drawEntity(en));
    i++;
    if (i > 20) {
      await sleep(0);
      i = 0;
    }
  }
  return points;
}

export default async (result: IDxf, scene: Scene) => {
  let i = 0;
  const points: Vector3[][] = [];
  points.push(...(await drawEntitys(result.entities)));
  for (const key in result.blocks) {
    i++;
    if (result.blocks[key].entities) {
      points.push(...(await drawEntitys(result.blocks[key].entities)));
    }
    if (i > 20) {
      await sleep(0);
      i = 0;
    }
  }
  console.log("points: ", points);
  (scene.activeCamera as ArcRotateCamera).setTarget(points[0][0]);
  return CreateLineSystem("line", { lines: points }, scene);
};
