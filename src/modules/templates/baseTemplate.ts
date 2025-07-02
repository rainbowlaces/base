import { di } from "../../core/di/baseDi";
import { BaseTemplates } from "./baseTemplates";
import { type TemplateResult } from "./engine/templateResult";
import { type TemplateFactories, type TagFactories } from "./types";

export abstract class BaseTemplate<T> {

    @di<BaseTemplates>(BaseTemplates)
    accessor #templates!: BaseTemplates;

    protected readonly data: T;

    constructor(data: T) {
        this.data = data;
    }

    get tags(): TagFactories {
        return this.#templates.tagFactories;
    }

    get templates(): TemplateFactories {
        return this.#templates.templateFactories;
    }

    abstract render(): TemplateResult;

}