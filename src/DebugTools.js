import {ConfigManager} from "./ConfigManager.js";

export class DebugTools {
    constructor(panelElement) {
        this.CCONFIG = new ConfigManager();
    }

    inspectElement(object) {
        console.log(object);

    }
}