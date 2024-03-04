import Tag, { EndTag } from "../tag";
import EachTag from "./each";
import IfTag from "./if";

const tags: Array<typeof Tag> = [EachTag, IfTag, EndTag];

export default tags;
