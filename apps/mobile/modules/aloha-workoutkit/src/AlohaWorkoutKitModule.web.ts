import { registerWebModule, NativeModule } from 'expo';

// AlohaWorkoutKitModule is not available on the web platform.
class AlohaWorkoutKitModule extends NativeModule<{}> {}

export default registerWebModule(AlohaWorkoutKitModule, 'AlohaWorkoutKitModule');
