// ResponseEntity.ts
export class ResponseEntity<T = unknown> {
  code: string = "";
  status: number = 0;
  message: string = "";
  data?: T; // <- aquí vive el genérico

  constructor(init?: Partial<ResponseEntity<T>>) {
    Object.assign(this, init);
  }

  // Permite setear varios campos con tipado
  set(values: Partial<ResponseEntity<T>>): this {
    Object.assign(this, values);
    return this;
  }

  get(): ResponseEntity<T> {
    return this;
  }

  // Helpers opcionales
  static ok<T>(data: T, message = "OK"): ResponseEntity<T> {
    return new ResponseEntity<T>({
      code: "OK",
      status: 200,
      message,
      data,
    });
  }

  static error<T = unknown>(message: string, status = 500, code = "ERROR"): ResponseEntity<T> {
    return new ResponseEntity<T>({ code, status, message });
  }
}
