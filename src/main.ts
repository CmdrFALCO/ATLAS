import { AtlasEngine } from './core/AtlasEngine';
// import { MnemosyneModule } from './modules/mnemosyne/MnemosyneModule';
import { ThemisModule } from './modules/themis/ThemisModule';

// Bootstrapping
const engine = AtlasEngine.getInstance();
// Load Themis (Phase 3)
engine.loadModule(new ThemisModule());
