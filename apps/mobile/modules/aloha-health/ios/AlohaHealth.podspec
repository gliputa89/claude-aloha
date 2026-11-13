Pod::Spec.new do |s|
  s.name           = 'AlohaHealth'
  s.version        = '1.0.0'
  s.summary        = 'Biegi z Apple Zdrowie dla Aloha (HealthKit)'
  s.description    = 'Odczyt biegów i marszów z Apple Zdrowie: czas, dystans, przewyższenie, przebieg tempa i tętna.'
  s.author         = 'Aloha Training'
  s.homepage       = 'https://alohatraining.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'HealthKit'
  # WorkoutKit (iOS 17) tylko do odczytu, z którego treningu Aloha pochodzi bieg – słabe linkowanie dla iOS 16.
  s.weak_frameworks = 'WorkoutKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
