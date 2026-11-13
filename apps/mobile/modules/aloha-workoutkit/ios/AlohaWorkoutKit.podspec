Pod::Spec.new do |s|
  s.name           = 'AlohaWorkoutKit'
  s.version        = '1.0.0'
  s.summary        = 'Treningi Aloha na Apple Watch (WorkoutKit)'
  s.description    = 'Planowanie treningów Aloha w aplikacji Trening na Apple Watch przez WorkoutKit (iOS 17+).'
  s.author         = 'Aloha Training'
  s.homepage       = 'https://alohatraining.app'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # WorkoutKit jest od iOS 17, aplikacja wspiera 16.4 – słabe linkowanie, żeby starszy iOS się uruchomił.
  s.weak_frameworks = 'WorkoutKit'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
