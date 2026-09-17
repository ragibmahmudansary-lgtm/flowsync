declare module "occt-import-js" {
  interface OcctModule {
    ReadStepFile(data: Uint8Array): any;
    ReadIgesFile(data: Uint8Array): any;
    ReadBrepFile(data: Uint8Array): any;
  }

  interface OcctOptions {
    locateFile?: (filename: string) => string;
  }

  const factory: (options?: OcctOptions) => Promise<OcctModule>;
  export default factory;
}
