import { NativeModule, requireNativeModule } from 'expo';

declare class AlohaWorkoutKitModule extends NativeModule<{}> {
  setValueAsync(value: string): Promise<void>;
}

export default requireNativeModule<AlohaWorkoutKitModule>('AlohaWorkoutKit');
