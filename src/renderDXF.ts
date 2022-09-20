import {
  ArcRotateCamera,
  Color3,
  CreateLines,
  CreateLineSystem,
  LinesMesh,
  Matrix,
  Scene,
  Tools,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  IBlock,
  IDxf,
  IEntity,
  IInsertEntity,
  IPoint,
  IPolylineEntity,
  ITables,
} from "dxf-parser";
import { sleep } from "./utils/sleep";
import createArcForLWPolyine from "./util/createArcForLWPolyline";
import colors from "./util/colors";
import { zoomAll } from "./util/zoomall";

const BlockMap = new Map<string, LinesMesh>();
let parsed: IDxf;
let blocks: Record<string, IBlock>;
let scene: Scene;
let target: Vector3;
let blocksMesh = [];

const scale = 1e6;

const AsVector3 = (p) => {
  return new Vector3(p.x / scale, p.y / scale, p.z / scale);
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

function renderPloyline(entity: IPolylineEntity) {
  const vertices = entity.vertices;
  if (!vertices?.length) return [];

  const ps: Vector3[] = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    const from = AsVector3(vertices[i]);
    const to = AsVector3(vertices[i + 1]);
    ps.push(from);
    if (vertices[i].bulge) {
      const points = createArcForLWPolyine(from, to, vertices[i].bulge);
      ps.push(...points.map(AsVector3));
    }
    if (i === vertices.length - 2) {
      ps.push(to);
    }
  }

  // const ps = vertices.map((v) => new Vector3(v.x, v.y, v.z));
  // ps.forEach((p) => {
  //   if (entity["elevation"]) {
  //     console.log(entity["elevation"]);
  //   }
  //   Vector3.TransformCoordinatesToRef(p, mtx, p);
  //   p.addToRef(nor.scale(entity["elevation"] ?? 0), p);
  // });
  return ps;
}
function renderLine(en: IEntity) {
  const vertices = en["vertices"] as IPoint[];
  if (vertices?.length) {
    const ps = vertices.map(AsVector3);
    if (!target) target = ps[0];
    return ps;
  }
  return;
}

async function drawEntity(en: IEntity, index) {
  switch (en.type) {
    case "LINE":
      return renderLine(en);
    case "POLYLINE":
    case "LWPOLYLINE":
      return renderPloyline(en as IPolylineEntity);
    case "INSERT": {
      const { xScale, yScale, zScale, position, rotation, name } =
        en as IInsertEntity;
      //   if (name !== "D1") return [];
      const block = parsed.blocks[name];
      let lines: LinesMesh[];

      if (block.entities) {
        if (BlockMap.has(name)) {
          lines = [BlockMap.get(name).clone(name)];
        } else {
          lines = await drawEntitys(block.entities, block);
          BlockMap.set(name, lines[0]);
        }
        for (const l of lines) {
          setColor(en, l);
          l.scaling = new Vector3(xScale ?? 1, yScale ?? 1, zScale ?? 1);
          l.rotation.z = Tools.ToRadians(rotation ?? 0);
          l.position = AsVector3(position);
          blocksMesh.push(l);
        }
      }
      return lines;
    }
    default:
      return [];
  }
}

function toRgba(color: number) {
  let rgb = [];

  let b = color & 0xff;

  let g = (color >> 8) & 0xff;

  let r = (color >> 16) & 0xff;

  rgb[0] = r;

  rgb[1] = g;

  rgb[2] = b;

  return rgb;
}

function setColor(entity: IEntity, line: LinesMesh) {
  const layerTable = parsed.tables.layer.layers;
  let rbg = [];
  if (layerTable) {
    rbg = layerTable[entity.layer].color
      ? toRgba(layerTable[entity.layer].color)
      : colors[layerTable[entity.layer].colorIndex];
  } else {
    rbg = [255, 255, 255];
  }
  line.color = Color3.FromArray(rbg);
}
let ii = 0;

async function drawEntitys(ens: IEntity[], block?: IBlock,root?:boolean) {
  let i = 0;
  const lines: LinesMesh[] = [];
    

  if (block) {
    const points: Vector3[][] = [];
    const ls: LinesMesh[] = [];
    for (const en of ens) {
      const ps = await drawEntity(en, ii);
      if (ps.length > 0) {
        if (ps[0] instanceof LinesMesh) {
          ls.push(...(ps as LinesMesh[]));
        } else {
          points.push(ps as Vector3[]);
        }
      }
      i++;
      if (i > 20) {
        await sleep(0);
        i = 0;
      }
    }
    const line = CreateLineSystem(block.name, { lines: points }, scene);
    for (const l of ls) {
      l.parent = line;
    }
    lines.push(line);
  } else {
    for (const en of ens) {
      const ps = await drawEntity(en, ii);
      if (ps.length > 0) {
        if (ps[0] instanceof Vector3) {
          const line = CreateLines(
            en.layer,
            { points: ps as Vector3[] },
            scene
          );
          setColor(en, line);
          lines.push(line);
        } else {
          lines.push(...(ps as LinesMesh[]));
        }
      }
      i++;
      ii++;
      if (i > 20) {
        await sleep(0);
        i = 0;
      }
    }
  }

  return lines;
}

export default async (result: IDxf, scene: Scene) => {
  parsed = result;
  scene = scene;
  target = null;
  blocksMesh = [];
  BlockMap.clear();
  const lines: LinesMesh[] = [];
  lines.push(...(await drawEntitys(result.entities,null,true)));

  //   if(blocksMesh.length>2)
  //   zoomAll(scene, blocksMesh.slice(0,2));
  // (scene.activeCamera as ArcRotateCamera).setTarget(target);
  // return CreateLineSystem("line", { lines: lines }, scene);
};
