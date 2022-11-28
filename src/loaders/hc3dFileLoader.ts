import {
  AbstractMesh,
  AssetContainer,
  DataReader,
  IFileRequest,
  ISceneLoaderAsyncResult,
  ISceneLoaderPlugin,
  ISceneLoaderPluginAsync,
  ISceneLoaderPluginExtensions,
  ISceneLoaderProgressEvent,
  LoadFileError,
  Logger,
  Nullable,
  Observable,
  Scene,
  SceneLoader,
  Tools,
  WebRequest,
} from "@babylonjs/core";
import { OBJFileLoader } from "@babylonjs/loaders";
import { GLTFFileLoader } from "@babylonjs/loaders/glTF/glTFFileLoader";

function readAsync(
  arrayBuffer: ArrayBuffer,
  byteOffset: number,
  byteLength: number
): Promise<Uint8Array> {
  try {
    return Promise.resolve(new Uint8Array(arrayBuffer, byteOffset, byteLength));
  } catch (e) {
    return Promise.reject(e);
  }
}

declare module "@babylonjs/loaders/glTF/glTFFileLoader" {
  export interface GLTFFileLoader {
    loadEncryptionFile: (
      scene: Scene,
      fileOrUrl: File | string,
      onSuccess: (data: any, responseURL?: string) => void,
      onProgress?: (ev: ISceneLoaderProgressEvent) => void,
      useArrayBuffer?: boolean,
      onError?: (request?: WebRequest, exception?: LoadFileError) => void
    ) => IFileRequest;
  }
}
declare module "@babylonjs/loaders/OBJ/oBJFileLoader" {
  export interface OBJFileLoader {
    loadEncryptionFile: (
      scene: Scene,
      fileOrUrl: File | string,
      onSuccess: (data: any, responseURL?: string) => void,
      onProgress?: (ev: ISceneLoaderProgressEvent) => void,
      useArrayBuffer?: boolean,
      onError?: (request?: WebRequest, exception?: LoadFileError) => void
    ) => IFileRequest;
    loadAsync(
      scene: Scene,
      data: any,
      rootUrl: string,
      onProgress?: (event: ISceneLoaderProgressEvent) => void,
      fileName?: string
    ): Promise<void>;
  }
}

const map = ["a", "g", "{", "}", ".", "c", "e", "u", "i", "n"];

function decrypte(content: string) {
  let newContent = "";
  for (let i = 0; i < 2000; i++) {
    const s = content[i];
    if (!isNaN(parseFloat(s))) {
      newContent += map[Number(s)];
    } else {
      const index = map.indexOf(s);
      if (index !== -1) {
        newContent += index;
      } else {
        newContent += s;
      }
    }
  }

  newContent += content.slice(2000);

  return newContent;
}

GLTFFileLoader.prototype.loadEncryptionFile = function (
  scene: Scene,
  fileOrUrl: File | string,
  onSuccess: (data: any, responseURL?: string) => void,
  onProgress?: (ev: ISceneLoaderProgressEvent) => void,
  useArrayBuffer?: boolean,
  onError?: (request?: WebRequest, exception?: LoadFileError) => void
) {
  this["_progressCallback"] = onProgress;

  const rootUrl = (fileOrUrl as File).name
    ? "file:"
    : Tools.GetFolderPath(fileOrUrl as string);
  const fileName =
    (fileOrUrl as File).name || Tools.GetFilename(fileOrUrl as string);

  if (useArrayBuffer) {
    if (this.useRangeRequests) {
      if (this.validate) {
        Logger.Warn(
          "glTF validation is not supported when range requests are enabled"
        );
      }

      const fileRequest: IFileRequest = {
        abort: () => {},
        onCompleteObservable: new Observable<IFileRequest>(),
      };

      const dataBuffer = {
        readAsync: (byteOffset: number, byteLength: number) => {
          return new Promise<ArrayBufferView>((resolve, reject) => {
            this._loadFile(
              scene,
              fileOrUrl,
              (data) => {
                resolve(new Uint8Array(data as ArrayBuffer));
              },
              true,
              (error) => {
                reject(error);
              },
              (webRequest) => {
                webRequest.setRequestHeader(
                  "Range",
                  `bytes=${byteOffset}-${byteOffset + byteLength - 1}`
                );
              }
            );
          });
        },
        byteLength: 0,
      };

      this["_unpackBinaryAsync"](new DataReader(dataBuffer)).then(
        (loaderData) => {
          fileRequest.onCompleteObservable.notifyObservers(fileRequest);
          onSuccess(loaderData);
        },
        onError ? (error) => onError(undefined, error) : undefined
      );

      return fileRequest;
    }

    return this._loadFile(
      scene,
      fileOrUrl,
      (data) => {
        this["_validate"](scene, data as ArrayBuffer, rootUrl, fileName);
        this["_unpackBinaryAsync"](
          new DataReader({
            readAsync: (byteOffset, byteLength) =>
              readAsync(data as ArrayBuffer, byteOffset, byteLength),
            byteLength: (data as ArrayBuffer).byteLength,
          })
        ).then(
          (loaderData) => {
            onSuccess(loaderData);
          },
          onError ? (error) => onError(undefined, error) : undefined
        );
      },
      true,
      onError
    );
  }

  return this._loadFile(
    scene,
    fileOrUrl,
    (data) => {
      const data2 = decrypte(data as string);
      this["_validate"](scene, data2, rootUrl, fileName);
      onSuccess({ json: this["_parseJson"](data2 as string) });
    },
    useArrayBuffer,
    onError
  );
};

OBJFileLoader.prototype.loadEncryptionFile = function (
  scene: Scene,
  fileOrUrl: File | string,
  onSuccess: (data: any, responseURL?: string) => void,
  onProgress?: (ev: ISceneLoaderProgressEvent) => void,
  useArrayBuffer?: boolean,
  onError?: (request?: WebRequest, exception?: LoadFileError) => void
) {
  return scene._loadFile(
    fileOrUrl,
    (data) => {
      const data2 = decrypte(data as string);
      onSuccess(data2);
    },
    onProgress,
    true,
    false,
    onError
  );
};

export class HC3DFileLoader implements ISceneLoaderPluginAsync {
  private _assetContainer: Nullable<AssetContainer> = null;
  private _types=new Map<string,string>();
  private _gltfLoader: GLTFFileLoader;
  private _objLoader: OBJFileLoader;
  name = "hc3d";
  extensions: string | ISceneLoaderPluginExtensions = ".hc3d";
  get GLTFLoader() {
    if (!this._gltfLoader) this._gltfLoader = new GLTFFileLoader();

    return this._gltfLoader;
  }
  get OBJLoader() {
    if (!this._objLoader) this._objLoader = new OBJFileLoader().createPlugin() as OBJFileLoader;

    return this._objLoader;
  }
  public getFileLoader(type: string) {
    switch (type) {
      case "gltf":
      case "glb":
        return this.GLTFLoader;
      case "obj":
        return this.OBJLoader;
      default:
        return null;
    }
  }
  public loadFile(
    scene: Scene,
    fileOrUrl: string,
    onSuccess: (data: any, responseURL?: string) => void,
    onProgress?: (ev: ISceneLoaderProgressEvent) => void,
    useArrayBuffer?: boolean,
    onError?: (request?: WebRequest, exception?: LoadFileError) => void
  ): IFileRequest {
    let request: IFileRequest = {
      onCompleteObservable: null,
      abort: null,
    };
    scene._loadFile(fileOrUrl, (json) => {
      try {
        const data = JSON.parse(json as string);
        if (data.type && data.entry) {
          this._types.set(fileOrUrl,data.type);
          const loader = this.getFileLoader(data.type);
          const strs = fileOrUrl.split("/");
          const fileName = strs[strs.length - 1];
          const req = loader.loadEncryptionFile(
            scene,
            fileOrUrl.replace(fileName, data.entry),
            onSuccess,
            onProgress,
            loader.extensions["." + data.type]?.isBinary,
            onError
          );
          Object.assign(request, req);
        }
      } catch (err) {
        return request;
      }
    });
    return request;
  }
  loadAssetContainerAsync(
    scene: Scene,
    data: any,
    rootUrl: string,
    onProgress?: (event: ISceneLoaderProgressEvent) => void,
    fileName?: string
  ): Promise<AssetContainer> {
    return null;
  }
  importMeshAsync(
    meshesNames: any,
    scene: Scene,
    data: any,
    rootUrl: string,
    onProgress?: (event: ISceneLoaderProgressEvent) => void,
    fileName?: string
  ): Promise<ISceneLoaderAsyncResult> {
    return this.getFileLoader(this._type).importMeshAsync(
      meshesNames,
      scene,
      data,
      rootUrl,
      onProgress,
      fileName
    );
  }
  loadAsync(
    scene: Scene,
    data: any,
    rootUrl: string,
    onProgress?: (event: ISceneLoaderProgressEvent) => void,
    fileName?: string
  ): Promise<void> {

    return this.getFileLoader(this._types.get(rootUrl+fileName)).loadAsync(
      scene,
      data,
      rootUrl,
      onProgress,
      fileName
    );
  }
}

SceneLoader.RegisterPlugin(new HC3DFileLoader());
