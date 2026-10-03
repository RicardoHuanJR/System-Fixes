import { checkRuntimeCompatibility, registerSettings } from "./scripts/settings.js";
import { installDiagnosticGlobal } from "./scripts/diagnostic.js";
import { installLayoutManager } from "./scripts/layout.js";
import { installBasicActionAutomation } from "./scripts/basic-actions.js";
import "./scripts/integration.js";

Hooks.once("init", registerSettings);
Hooks.once("ready", checkRuntimeCompatibility);
installDiagnosticGlobal();
installLayoutManager();
installBasicActionAutomation();

console.info("Argon OPRPG | Adaptador 6.4.0 carregado; aguardando registro no Argon Core.");
