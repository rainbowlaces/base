import BaseContext from "./baseContext";

interface InitContextData {}

export class BaseInitContext extends BaseContext<InitContextData> {
  constructor() {
    super(
      (id: string, module: string, action: string, status: string) =>
        `/base/init/${id}/${module}/${action}/${status}`,
    );
  }
}
