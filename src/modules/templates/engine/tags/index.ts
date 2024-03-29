import Tag, { EndTag } from "../tag";
import EachTag from "./each";
import IfTag from "./if";
import UnsafeTag from "./unsafe";

const tags: Array<typeof Tag> = [EachTag, IfTag, EndTag, UnsafeTag];

export default tags;
