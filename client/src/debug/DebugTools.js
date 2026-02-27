import {ConfigService} from "../services/ConfigService.js";

export class DebugTools {
    constructor(panelElement) {
        this.CCONFIG = new ConfigService();
    }

    inspectElement(object) {
        console.log(object);

    }
}