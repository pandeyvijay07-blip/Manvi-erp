declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

declare interface Request {
  method: string;
  headers: Headers;
  json(): Promise<any>;
}

declare interface Response {
  status?: number;
  headers?: HeadersInit;
}
