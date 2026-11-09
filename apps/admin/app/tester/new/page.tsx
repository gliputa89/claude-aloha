import { CreateUsersForm } from '@/components/tester/create-users';
import { SURVEY_PRESETS } from '@/lib/survey';

export default function NewTestUsersPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Nowi użytkownicy testowi</h1>
        <p className="text-sm text-text-muted">
          Konta bez hasła i bez maili (adres <code>test+…@aloha.test</code>), z wypełnioną ankietą. Daty zawodów liczone
          od dziś. Po utworzeniu ankietę możesz dowolnie edytować. Konta testowe można potem usunąć jednym kliknięciem.
        </p>
      </header>
      <CreateUsersForm presets={SURVEY_PRESETS.map(({ key, label }) => ({ key, label }))} />
    </div>
  );
}
