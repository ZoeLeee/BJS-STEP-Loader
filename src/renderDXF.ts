import { CreateLineSystem, Matrix, Scene, Vector3 } from "@babylonjs/core";
import { IDxf, IEntity, IPoint } from "dxf-parser";
import { sleep } from "./utils/sleep";

const AsVector3=(p)=>{
    return new Vector3(p.x,p.y,p.z);
}
const YAxis=new Vector3(0,1);
const ZAxis=new Vector3(0,0,1);
const ComputUpDirection=(n: Vector3, ay: Vector3 = new Vector3(), ax: Vector3 = new Vector3()): Vector3=>
{
    n.normalize();
    if (Math.abs(n.x) < 0.015625 && Math.abs(n.y) < 0.015625){
        n.copyFrom(ax.cross(YAxis))
    }
    else
        n.copyFrom(ax.cross(ZAxis))

    ax.copyFrom(ay.cross(n))
    ax.normalize();
    ay.normalize();
    return ay;
}

const GetMatrix4=(en:IEntity)=>
{
    let nor = new Vector3(0, 0, 1);
    if (en["extrusionDirection"])
        nor.copyFrom(AsVector3(en["extrusionDirection"]));
    else if (en["extrusionDirectionX"] !== undefined && en["extrusionDirectionY"] !== undefined && en["extrusionDirectionZ"] !== undefined)
        nor.set(en["extrusionDirectionX"], en["extrusionDirectionY"], en["extrusionDirectionZ"]);

    let x = new Vector3();
    let y = new Vector3();
    ComputUpDirection(nor, y, x);
    const mtx=new Matrix()
     Matrix.FromXYZAxesToRef(x,y,nor,mtx);
     return mtx
}

export default async (result:IDxf,scene:Scene)=>{
    let i=0
    const points:Vector3[][]=[]
    for(const en of result.entities){
        if(en.type==="LINE"||en.type==="LWPOLYLINE"){
            const vertices=en["vertices"] as IPoint[] 
            const ps=vertices.map(v=>new Vector3(v.x,v.y,v.z))
            const mtx=GetMatrix4(en);
            const nor=mtx.getRow(2).toVector3()
            if(en.type==="LWPOLYLINE"){
                ps.forEach(p=>{
                    if(en["elevation"]){
                        console.log(en["elevation"]);
                    }
                    Vector3.TransformCoordinatesToRef(p,mtx,p);
                    p.addToRef(nor.scale(en["elevation"]??1),p)
                })
            }
            points.push(ps)
        }
        i++;
        if(i>20){
            await sleep(0);
            i=0
        }
    }
    for(const key in result.blocks){
        i++;
        if(result.blocks[key].entities){
            let j=0
            for(const en of result.blocks[key].entities){
                if(en.type==="LINE"||en.type==="LWPOLYLINE"){
                    const vertices=en["vertices"] as IPoint[] 
                    const ps=vertices.map(v=>new Vector3(v.x,v.y,v.z))
                    const mtx=GetMatrix4(en);
                    const nor=mtx.getRow(2).toVector3()
                    if(en.type==="LWPOLYLINE"){
                        ps.forEach(p=>{
                            if(en["elevation"]){
                                console.log(en["elevation"]);
                            }
                            Vector3.TransformCoordinatesToRef(p,mtx,p);
                            p.addToRef(nor.scale(en["elevation"]??1),p)
                        })
                    }
                    points.push(ps)
                }
                if(j>20){
                    await sleep(0);
                    j=0
                }
               
            }
        }
        if(i>20){
            await sleep(0);
            i=0
        }
    }
    return CreateLineSystem("line",{lines:points},scene)
}