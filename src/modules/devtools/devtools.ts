import crypto from "crypto";
import { baseModule } from "../../core/module/decorators/baseModule.js";
import { BaseModule } from "../../core/module/baseModule.js";
import { di } from "../../core/di/baseDi.js";
import { request } from "../../core/requestHandler/decorators/request.js";
import { type BaseHttpActionArgs } from "../../core/requestHandler/types.js";

@baseModule()
export class BaseDevtools extends BaseModule {
    @di("fsRoot")
    accessor fsRoot!: string;
    
    @request({ topic: "/get/.well-known/appspecific/com.chrome.devtools.json", phase: 50 })
    async handleDevtoolsJson({ context: ctx }: BaseHttpActionArgs) {
        
        const workspaceId = crypto.createHash('sha256').update(this.fsRoot).digest('hex');

        const devtoolsConfig = {
            workspace: {
                root: this.fsRoot,
                uuid: workspaceId
            }
        };

        this.logger.debug(`Serving devtools workspace config for root: ${this.fsRoot}`);
        void ctx.res.json(devtoolsConfig);
    }
}