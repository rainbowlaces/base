import { type Tag, EndTag } from "../tag";
import { EachTag } from "./each";
import { IfTag } from "./if";
import { UnsafeTag } from "./unsafe";

// eslint-disable-next-line @typescript-eslint/naming-convention
const tags: typeof Tag[] = [EachTag, IfTag, EndTag, UnsafeTag];

export { tags };
