import {
  AssetContainer,
  Color3,
  Color4,
  Geometry,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Nullable,
  ParticleSystem,
  PointsCloudSystem,
  PolygonMeshBuilder,
  Scene,
  StandardMaterial,
  Vector2,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";

import earcut from "earcut";

window["earcut"] = earcut;

// declare let earcut: any;

type MeshObject = {
  name: string;
  indices?: Array<number>;
  positions?: Array<number>;
  normals?: Array<number>;
  colors?: Array<number>;
  uvs?: Array<number>;
  materialName: string;
  directMaterial?: Nullable<Material>;
};

type Vector2D = [Vector3, Vector3];
type Vector3D = [Vector3, Vector3, Vector3];
type LineVector = [Vector3, SVector];
type TEdge = [Vector2D, LineVector];
type SVector = [Vector3, number];
type TOrientedEdge = [TEdge, boolean];
type TEdgeLoop = TOrientedEdge[];
type TFaceOuterBound = [TEdgeLoop, boolean];
type TAdFace = [TFaceOuterBound[], Vector3D, boolean];
type TCloseShell = TAdFace[];

function arrayLast<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

function closedEdge(loopEdge: TEdgeLoop) {
  const newEdges: TEdgeLoop = [loopEdge.shift()];
  const cache = new Set();
  while (cache.size !== loopEdge.length) {
    for (const edge of loopEdge) {
      if (cache.has(edge)) continue;
      const lastEdge = arrayLast(newEdges);
      const s1 = lastEdge[0][0][0];
      const e1 = lastEdge[0][0][1];

      const s2 = edge[0][0][0];
      const e2 = edge[0][0][1];

      if (e1.equals(s2)) {
        newEdges.push(edge);
        cache.add(edge);
      } else if (e1.equals(e2)) {
        edge[0][0].reverse();
        newEdges.push(edge);
        cache.add(edge);
      }
    }
  }
  return newEdges;
}

/**
 * Class used to load mesh data from OBJ content
 */
export class SolidParser {
  /**
   * Function used to parse an OBJ string
   * @param meshesNames defines the list of meshes to load (all if not defined)
   * @param data defines the OBJ string
   * @param scene defines the hosting scene
   * @param assetContainer defines the asset container to load data in
   * @param onFileToLoadFound defines a callback that will be called if a MTL file is found
   */
  static DATA_LINE = /^(#)\d+(\s)=/;
  static CART_POINT_REG = /\(\s[\d\s-].+\)/;
  static Data_REG = /\(\s.+\)/;
  static ID_REG = /\(\s[\d\s#].+\)/;
  static CART_POINT = "CARTESIAN_POINT";
  static VER_POINT = "VERTEX_POINT";
  static VECTOR = "VECTOR";
  static EDGE_CURVE = "EDGE_CURVE";
  static LINE = "LINE";
  static DIRECTION = "DIRECTION";
  static ORIENTED_EDGE = "ORIENTED_EDGE";
  static EDGE_LOOP = "EDGE_LOOP";
  static FACE_OUTER_BOUND = "FACE_OUTER_BOUND";
  static FACE_BOUND = "FACE_BOUND";
  static AXIS2_PLACEMENT_3D = "AXIS2_PLACEMENT_3D";
  static PLANE = "PLANE";
  static ADVANCED_FACE = "ADVANCED_FACE";
  static CLOSED_SHELL = "CLOSED_SHELL";
  private _positions: Array<Vector3> = []; //values for the positions of vertices
  private _normals: Array<Vector3> = []; //Values for the normals
  private _uvs: Array<Vector2> = []; //Values for the textures
  private pointMap = new Map<string, Vector3>();
  private DirMap = new Map<string, Vector3>();
  private VertexPointMap = new Map<string, Vector3>();
  private VectorMap = new Map<string, SVector>();
  private EdgeMap = new Map<string, TEdge>();
  //法线
  private LineMap = new Map<string, LineVector>();
  private OrientedEdgeMap = new Map<string, TOrientedEdge>();
  private EdgeLoopMap = new Map<string, TEdgeLoop>();
  private FaceOuterMap = new Map<string, TFaceOuterBound>();
  private Vector3DMap = new Map<string, Vector3D>();
  private PlaneMap = new Map<string, Vector3D>();
  private AdvFaceMap = new Map<string, TAdFace>();
  private CloseShellMap = new Map<string, TCloseShell>();
  public parse(
    meshesNames: any,
    data: string,
    scene: Scene,
    assetContainer: Nullable<AssetContainer>,
    onFileToLoadFound: (fileToLoad: string) => void
  ): void {
    // Split the file into lines
    const lines = data.split("\n");
    const vectors: Vector3[] = [];
    const getVertex: (() => SVector)[] = [];
    const getVertexPoint: (() => Vector3)[] = [];
    const getVector3D: (() => Vector3D)[] = [];
    const getEdgeCurves: (() => TEdge)[] = [];
    const getLineCurves: (() => LineVector)[] = [];
    const getOrientedEdge: (() => TOrientedEdge)[] = [];
    const getEdgeLoop: (() => TEdgeLoop)[] = [];
    const getFaceOuterBound: (() => TFaceOuterBound)[] = [];
    const getPlane: (() => Vector3D)[] = [];
    const getAdvFace: (() => TAdFace)[] = [];
    const getCloseShell: (() => TCloseShell)[] = [];

    for (const line of lines) {
      const matchResult = line.match(SolidParser.DATA_LINE);
      if (matchResult) {
        if (matchResult.index === 0) {
          const startIndex = matchResult[0].length;
          const ID = matchResult[0].slice(0, -1).trim();
          if (this.isVail(line, SolidParser.CART_POINT, startIndex)) {
            const matchRes = line.match(SolidParser.CART_POINT_REG);
            if (matchRes) {
              const points = matchRes[0]
                .slice(2, -4)
                .split(",")
                .map(parseFloat);
              vectors.push(Vector3.FromArray(points));
              this.pointMap.set(ID.trim(), Vector3.FromArray(points));
            }
          } else if (this.isVail(line, SolidParser.DIRECTION, startIndex)) {
            const matchRes = line.match(SolidParser.CART_POINT_REG);
            if (matchRes) {
              const dir = matchRes[0].trim().slice(1, -1).split(",");

              this.DirMap.set(
                ID,
                new Vector3(
                  parseFloat(dir[0].trim()),
                  parseFloat(dir[1].trim()),
                  parseFloat(dir[2].trim())
                )
              );
            }
          } else if (this.isVail(line, SolidParser.VER_POINT, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].slice(3, -2).split(",");
              const cid = points[1].trim();
              getVertexPoint.push(() => {
                const p = this.pointMap.get(cid);
                this.VertexPointMap.set(ID, p);
                return p;
              });
            }
          } else if (
            this.isVail(line, SolidParser.AXIS2_PLACEMENT_3D, startIndex)
          ) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].slice(3, -2).split(",");

              getVector3D.push(() => {
                const ps = [
                  this.pointMap.get(points[1].trim()),
                  this.DirMap.get(points[2].trim()),
                  this.DirMap.get(points[3].trim()),
                ] as Vector3D;
                this.Vector3DMap.set(ID, ps);
                return ps;
              });
            }
          } else if (this.isVail(line, SolidParser.PLANE, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].slice(3, -2).split(",");

              getPlane.push(() => {
                const p = this.Vector3DMap.get(points[1].trim());
                this.PlaneMap.set(ID, p);
                return p;
              });
            }
          } else if (this.isVail(line, SolidParser.VECTOR, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].trim().slice(1, -1).split(",");
              const cid = points[1].trim();
              getVertex.push(() => {
                const p = this.DirMap.get(cid);
                const v = [p, parseFloat(points[2].trim())] as SVector;
                this.VectorMap.set(ID, v);
                return v;
              });
            }
          } else if (this.isVail(line, SolidParser.EDGE_CURVE, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].trim().slice(1, -1).split(",");

              getEdgeCurves.push(() => {
                const v2d = [
                  this.VertexPointMap.get(points[1].trim()),
                  this.VertexPointMap.get(points[2].trim()),
                ] as Vector2D;

                const edge = [v2d, this.LineMap.get(points[3].trim())] as TEdge;
                this.EdgeMap.set(ID, edge);
                return edge;
              });
            }
          } else if (this.isVail(line, SolidParser.LINE, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].trim().slice(1, -1).split(",");

              getLineCurves.push(() => {
                const line = [
                  this.pointMap.get(points[1].trim()),
                  this.VectorMap.get(points[2].trim()),
                ] as LineVector;
                this.LineMap.set(ID, line);
                return line;
              });
            }
          } else if (this.isVail(line, SolidParser.ORIENTED_EDGE, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].trim().slice(1, -1).split(",");

              getOrientedEdge.push(() => {
                const edge = [
                  this.EdgeMap.get(points[3].trim()),
                  points[4].trim() === ".T.",
                ] as TOrientedEdge;
                this.OrientedEdgeMap.set(ID, edge);
                return edge;
              });
            }
          } else if (this.isVail(line, SolidParser.EDGE_LOOP, startIndex)) {
            const matchRes = line.match(SolidParser.ID_REG);
            if (matchRes) {
              const points = matchRes[0].trim().slice(1, -3).split(",");

              getEdgeLoop.push(() => {
                const edgeloop = points.map((p) =>
                  this.OrientedEdgeMap.get(p.trim())
                ) as TEdgeLoop;
                this.EdgeLoopMap.set(ID, edgeloop);
                return edgeloop;
              });
            }
          } else if (
            this.isVail(line, SolidParser.FACE_OUTER_BOUND, startIndex) ||
            this.isVail(line, SolidParser.FACE_BOUND, startIndex)
          ) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              const points = matchRes[0].trim().slice(1, -1).split(",");

              getFaceOuterBound.push(() => {
                const edgeloop = [
                  this.EdgeLoopMap.get(points[1].trim()),
                  points[2].trim() === ".T.",
                ] as TFaceOuterBound;
                this.FaceOuterMap.set(ID, edgeloop);
                return edgeloop;
              });
            }
          } else if (this.isVail(line, SolidParser.ADVANCED_FACE, startIndex)) {
            const matchRes = line.match(SolidParser.Data_REG);
            if (matchRes) {
              let str = matchRes[0].trim().slice(1, -1);

              const facesRest = str.match(SolidParser.Data_REG);
              if (!facesRest) continue;

              const temp = str.split("),")[1].split(",");

              const faces = facesRest[0].trim().slice(1, -1).split(",");

              getAdvFace.push(() => {
                const face = [
                  faces.map((f) => this.FaceOuterMap.get(f.trim())),
                  this.PlaneMap.get(temp[0].trim()),
                  temp[1].trim() === ".T.",
                ] as TAdFace;
                console.log("face: ", face);
                this.AdvFaceMap.set(ID, face);
                return face;
              });
            }
          } else if (this.isVail(line, SolidParser.CLOSED_SHELL, startIndex)) {
            const matchRes = line.match(SolidParser.ID_REG);
            if (matchRes) {
              const list = matchRes[0].trim().slice(1, -3).split(",");
              console.log("list: ", list);

              getCloseShell.push(() => {
                const shells = list.map((l) => {
                  return this.AdvFaceMap.get(l.trim());
                });
                this.CloseShellMap.set(ID, shells);
                return shells;
              });
            }
          }
        }
      }
    }

    let vertexs: Vector3[] = [];
    let positions: number[] = [];
    let indices: number[] = [];
    let normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    for (const f of getVertexPoint) {
      const p = f();
      vertexs.push(p);
    }
    for (const f of getVertex) {
      f();
    }

    for (const f of getLineCurves) {
      f();
    }

    for (const fv of getEdgeCurves) {
      const edge = fv();

      const line = edge[1];

      // let l = MeshBuilder.CreateLines(
      //   "lines",
      //   { points: [line[0], line[0].add(line[1][0].scale(line[1][1]))] },
      //   scene
      // );
      // l.color = new Color3(1, 1, 1);

      // let lines = MeshBuilder.CreateLines("lines", { points: edge[0] }, scene);
      // lines.color = new Color3(Math.random(), Math.random(), Math.random());
    }

    for (const f of getOrientedEdge) {
      const t = f();
    }

    for (const f of getEdgeLoop) {
      const edgeLoop = f();
      // console.log("edgeLoop: ", edgeLoop);
      // const c = new Color3(Math.random(), Math.random(), Math.random());
      // const allPoints: Vector3[] = [];
      // for (const edge of edgeLoop) {
      //   const edge = edge[0];

      //   // const line = edge[1];

      //   // let l = MeshBuilder.CreateLines(
      //   //   "lines",
      //   //   { points: [line[0], line[0].add(line[1][0].scale(line[1][1]))] },
      //   //   scene
      //   // );
      //   // l.color = new Color3(1, 1, 1);
      //   allPoints.push(...edge[0]);
      // }
      // console.log("all", allPoints);
      // let lines = MeshBuilder.CreateLines(
      //   "lines",
      //   { points: allPoints },
      //   scene
      // );
      // lines.color = c;
    }
    for (const f of getFaceOuterBound) {
      const t = f();
    }
    for (const f of getVector3D) {
      const t = f();
    }
    for (const f of getPlane) {
      const t = f();
    }
    for (const f of getAdvFace) {
      const t = f();
      // console.log("plane ", t);
    }

    const babylonMeshesArray: Mesh[] = [];
    const meshObjects: MeshObject[] = [];
    let testIndex = 0;
    for (const f of getCloseShell) {
      const t = f();
      console.log("t: ", t);
      const usePts: Vector3[] = [];
      let index = 0;
      for (const shell of t) {
        if (!shell[0]) continue;
        for (const edgeLoop of shell[0]) {
          const allPoints: Vector3[] = [];
          const loopEdge = closedEdge(edgeLoop[0]);
          for (const oedge of loopEdge) {
            const edge = oedge[0];
            if (edge) {
              const lastPt = arrayLast(allPoints);
              if (!lastPt || lastPt.equals(edge[0][0])) {
                allPoints.push(...edge[0]);
              } else {
                allPoints.push(...[...edge[0]].reverse());
              }
            } else {
              console.log(edge);
            }
          }
          const c = new Color3(Math.random(), Math.random(), Math.random());

          const uniPoints = Array.from(new Set([...allPoints]));
          console.log("uniPoints: ", uniPoints);
          let dir = shell[1][1];
          console.log("dir: ", dir);
          let nor = shell[1][2];
          console.log("nor: ", nor);

          // if (Math.abs(dir.z) - 1e-4 < 0) continue;

          const z = dir.clone();
          const x = nor.clone();
          const y = x.cross(z);
          const mtx = new Matrix();
          Matrix.FromXYZAxesToRef(x, y, z, mtx);

          mtx.invertToRef(mtx);

          let pos: number[] = [];
          for (const pt of uniPoints) {
            positions.push(pt.x, pt.y, pt.z);
            const newPt = Vector3.TransformCoordinates(pt, mtx);
            pos.push(newPt.x, newPt.y);
            normals.push(dir.x, dir.y, dir.z);
          }
          // for (const pt of allPoints) {
          //   const i = uniPoints.indexOf(pt);
          //   indices.push(i + index);
          // }
          console.log("pos: ", pos);
          const indexs = earcut(pos, null, 2) as number[];
          if (indexs.length === 3) {
            console.log(pos);
          }
          // indexs.reverse();
          indices.push(...indexs.map((i) => i + index));
          index += uniPoints.length;
          // let lines = MeshBuilder.CreateLines(
          //   "lines",
          //   { points: uniPoints },
          //   scene
          // );
          // lines.color = c;
          for (const oedge of edgeLoop[0]) {
            const edge = oedge[0];
            if (edge) {
              let lines = MeshBuilder.CreateLines(
                "lines",
                { points: edge[0] },
                scene
              );
              lines.color = c;
            } else {
              console.log(edge);
            }
          }
        }
        testIndex++;
        // if (testIndex === 4) {
        //   break;
        // }
      }

      // meshObjects.push({
      //   name: Geometry.RandomId(),
      //   indices,
      //   positions,
      //   normals,
      //   colors,
      //   uvs,
      //   materialName: "",
      // });
    }
    // positions = [10, 0, 1, 0, 50, 2, 60, 60, 3, 70, 10, 4];
    // normals = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
    // indices = earcut(positions, null, 3);

    const mesh = new Mesh("123", scene);
    // console.log("mesh: ", mesh);

    mesh.setVerticesData(VertexBuffer.PositionKind, positions);
    // console.log("positions: ", positions);
    // console.log("normals: ", normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals);
    // console.log("indices: ", indices);
    mesh.setIndices(indices);

    const mtl = new StandardMaterial("test");

    mtl.backFaceCulling = false;
    mesh.material = mtl;

    // mesh.computeWorldMatrix(true);
    const pcs = new PointsCloudSystem("pcs", 12, scene);
    const m = MeshBuilder.CreatePlane("test", { size: 10 });
    console.log("box: ", m);
    pcs.addPoints(getVertexPoint.length, function (particle, i) {
      particle.position = getVertexPoint[i]();

      particle.color = new Color4(
        Math.random(),
        Math.random(),
        Math.random(),
        Math.random()
      );
    });
    pcs.buildMeshAsync();
  }
  private isVail(line: string, target: string, startIndex: number) {
    return line.indexOf(target) === startIndex + 1;
  }
}
