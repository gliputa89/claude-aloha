import { Contact, OperatorAddress } from "@/components/legal/contact";
import type { LegalDocument } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";

export const privacyEn: LegalDocument = {
  title: "Privacy Policy",
  lead: (
    <>
      <p>
        Aloha App builds a running plan and adjusts it to your day. To do that it needs data about your
        running and, with your consent, health data: how you feel, pain you report and heart rate from your
        runs.
      </p>
      <p>
        This document explains what we collect in the Aloha App mobile app and on this website, why we collect
        it, who receives it and how you can control it. We do not sell data and we do not show ads.
      </p>
    </>
  ),
  sections: [
    {
      id: "controller",
      title: "Who is responsible for your data",
      body: (
        <>
          <p>The data controller is the owner of the app:</p>
          <OperatorAddress lang="en" />
          <p>
            For anything about personal data, write to us <Contact lang="en" />. We have not appointed a data
            protection officer.
          </p>
        </>
      ),
    },
    {
      id: "data",
      title: "What data we process",
      body: (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>What exactly</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Account</td>
                  <td>
                    E-mail address, a hash of your password (we never know the password itself), the name you
                    give us, language, time zone. If you sign in with Apple or Google: the account
                    identifier, e-mail address and first name.
                  </td>
                  <td>You, Apple or Google</td>
                </tr>
                <tr>
                  <td>Running survey</td>
                  <td>
                    Level, a recent result (distance and time), weekly distance, runs per week, your goal
                    (distance, race date and name, target time), and the days and time you have for training.
                  </td>
                  <td>You; some fields may be suggested from Strava</td>
                </tr>
                <tr>
                  <td>Plan and workouts</td>
                  <td>
                    Planned workouts, their status and your rating, distance and time you enter, plan changes
                    with their reasons, the review of a workout against the plan, AI coach notes.
                  </td>
                  <td>You and the app itself</td>
                </tr>
                <tr>
                  <td>Health data</td>
                  <td>
                    Your answer to the question about injuries and contraindications (yes or no), how you
                    feel in the check-in (1–5), the “little sleep” and “something hurts” tags, heart rate
                    from your runs (average, maximum and how it changed during the run), and messages to the
                    coach in which you write about your health. See section 3.
                  </td>
                  <td>You, Strava</td>
                </tr>
                <tr>
                  <td>Coach conversations</td>
                  <td>
                    Messages to the AI coach and to the human coach, proposed plan changes and your
                    decisions.
                  </td>
                  <td>You</td>
                </tr>
                <tr>
                  <td>Strava (optional)</td>
                  <td>
                    The identifier and name on your Strava account, access tokens, and your runs and walks:
                    name, date, distance, time, elevation gain, pace over successive segments and, with
                    health data consent, heart rate. We do not store your GPS route or start location.
                  </td>
                  <td>Strava, after you connect your account</td>
                </tr>
                <tr>
                  <td>Approximate location (optional)</td>
                  <td>
                    Coordinates rounded to 0.1° (about 10 km) and the name of the place, needed for the
                    weather forecast. See section 7.
                  </td>
                  <td>Your phone, with system permission, or a place name you type</td>
                </tr>
                <tr>
                  <td>Consents</td>
                  <td>A consent log: type, document version, and the date given or withdrawn.</td>
                  <td>The app itself</td>
                </tr>
                <tr>
                  <td>Technical data</td>
                  <td>IP address and basic device information in server logs, records of AI calls (section 5).</td>
                  <td>The app and the website</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            We do not collect your date of birth, sex, weight or height. The app has no access to your
            contacts, photos or microphone, does not track your route and does not send push notifications.
          </p>
        </>
      ),
    },
    {
      id: "health",
      title: "Health data",
      body: (
        <>
          <div className="callout">
            <p>
              <strong>
                How you feel, pain, sleep, heart rate and information about injuries are data concerning
                health, a special category of data (Article 9 GDPR). We process them only on the basis of
                your explicit consent.
              </strong>
            </p>
          </div>
          <p>
            We ask for consent separately: in the starting survey, the first time you mention your health in
            a coach conversation, or when you turn on the check-in in Profile. The consent box is never
            ticked in advance, and consent is not a condition of using the app.
          </p>
          <p>The consent covers:</p>
          <ul>
            <li>the daily check-in: how you feel and the “little sleep” and “something hurts” tags,</li>
            <li>heart rate from runs imported from Strava and what we conclude from it in the workout review,</li>
            <li>messages to the coach in which you write about pain, injury, illness or medication,</li>
            <li>your answer to the starting survey question about injuries and contraindications.</li>
          </ul>
          <p>
            Without consent the app works in basic mode: it builds your plan but shows no check-in, does not
            import heart rate, and does not store or forward messages about your health.
          </p>
          <p>
            You can withdraw consent at any time in Profile by turning the check-in off. From then on we
            collect no new health data. If you also want us to erase the health data collected earlier, write
            to us and we will do so within 30 days. Withdrawing consent does not affect the lawfulness of
            processing before the withdrawal.
          </p>
          <p>
            We use health data only to adjust your plan and the coach’s answers. We do not use it for
            marketing and we do not share it with insurers, employers or advertisers.
          </p>
        </>
      ),
    },
    {
      id: "purposes",
      title: "Why we process data and on what legal basis",
      body: (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Purpose</th>
                  <th>Data</th>
                  <th>Legal basis</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Creating your account, building and running your plan, coach conversations, weather, Strava</td>
                  <td>Account, survey, plan, conversations, Strava, approximate location</td>
                  <td>
                    Performance of the contract for using the app (Article 6(1)(b) GDPR), that is the{" "}
                    <a href={legalPath.terms.en}>Terms of Service</a>
                  </td>
                </tr>
                <tr>
                  <td>Check-in, heart rate, health conversations, a more careful plan if you report contraindications</td>
                  <td>Health data</td>
                  <td>Your explicit consent (Article 9(2)(a) GDPR)</td>
                </tr>
                <tr>
                  <td>Service security, detecting errors and abuse, controlling AI costs</td>
                  <td>Technical data, records of AI calls</td>
                  <td>Our legitimate interest (Article 6(1)(f) GDPR)</td>
                </tr>
                <tr>
                  <td>Aggregate usage statistics, without conversation content</td>
                  <td>Plan and workout data in aggregated form</td>
                  <td>Our legitimate interest in improving the app (Article 6(1)(f) GDPR)</td>
                </tr>
                <tr>
                  <td>Answering requests and complaints, establishing and defending legal claims</td>
                  <td>Account, correspondence, consent log</td>
                  <td>Article 6(1)(b), (c) and (f) GDPR</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Providing data is voluntary, but without an e-mail address and your survey answers we cannot
            create an account or build a plan. Strava, location and health data are entirely optional.
          </p>
          <p>
            The app automatically matches workouts to your answers and results, which is a form of profiling.
            Changes to your plan are proposals that you accept or decline. We do not make decisions about you
            that produce legal effects or similarly significantly affect you.
          </p>
        </>
      ),
    },
    {
      id: "ai",
      title: "Artificial intelligence",
      body: (
        <>
          <p>
            Some features run on Anthropic’s Claude models: building the next weeks of your plan, the race
            forecast, the workout review, coach notes, weather advice and the AI coach conversation. The daily
            check-in runs on simple rules, without AI.
          </p>
          <p>We send the model only what the task needs:</p>
          <ul>
            <li>your survey answers and goal, including whether you report contraindications,</li>
            <li>your plan and the status and ratings of your workouts,</li>
            <li>
              the actual distance, time and pace of a run and what we conclude from how it went, including
              when this comes from Strava; with health data consent also conclusions from heart rate (for
              example how it drifted during the run), but not the raw heart rate recording,
            </li>
            <li>the most recent messages in your AI coach conversation,</li>
            <li>the weather and workout type only – never your location.</li>
          </ul>
          <p>
            The model does not receive your e-mail address, name or account identifier, unless you type such
            details into a message to the coach yourself. Anthropic acts on our behalf as a processor and,
            under its terms for business customers, does not train its models on data sent through the API.
          </p>
          <p>
            We keep a record of each AI call, including its content, for 30 days so that we can investigate
            errors and monitor answer quality. After that only a technical record remains (date, feature,
            cost).
          </p>
          <p>
            AI answers can be wrong. The AI coach does not diagnose and does not replace a doctor or a
            physiotherapist.
          </p>
        </>
      ),
    },
    {
      id: "strava",
      title: "Strava",
      body: (
        <>
          <p>
            Connecting Strava is optional and done in Profile. We ask for permission to read your
            activities, including private ones. We import only runs and walks from the last 30 days. During
            the first survey we look once at the last 26 weeks of history to suggest your level; we do not
            store that history.
          </p>
          <p>
            We never post to or change anything in your Strava account. An activity you delete in Strava is
            removed from our records at the next sync.
          </p>
          <p>
            When you disconnect Strava in Profile, we revoke access on Strava’s side and delete the imported
            activities and tokens. Only the distance and time of workouts already marked as done remain in
            your plan.
          </p>
        </>
      ),
    },
    {
      id: "location",
      title: "Location and weather",
      body: (
        <>
          <p>
            The weather card needs to know roughly where you run. You can allow location “while using the
            app” or type the name of a place. Without either, the app works normally, just without weather.
          </p>
          <ul>
            <li>We ask the system for reduced-accuracy location and never read it in the background.</li>
            <li>
              We round coordinates on your phone to 0.1° (about 10 km). Only that value reaches our server
              and the forecast provider, Open-Meteo.
            </li>
            <li>
              The place name is resolved by your phone’s built-in service (Apple or Google), which receives
              your position or the text you typed for that purpose.
            </li>
            <li>Location is never sent to AI models.</li>
          </ul>
        </>
      ),
    },
    {
      id: "recipients",
      title: "Who receives your data",
      body: (
        <>
          <p>We rely on providers without whom the app could not work:</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Role</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Supabase</td>
                  <td>Database, sign-in, app server; data stored in the Frankfurt region (EU)</td>
                  <td>All account and app data</td>
                </tr>
                <tr>
                  <td>Anthropic</td>
                  <td>Claude AI models</td>
                  <td>The data described in section 5, without your e-mail or name</td>
                </tr>
                <tr>
                  <td>Strava</td>
                  <td>The source of your runs, if you connect your account</td>
                  <td>From us: only requests for your activities</td>
                </tr>
                <tr>
                  <td>Open-Meteo</td>
                  <td>Weather and air-quality forecast</td>
                  <td>Rounded coordinates, not linked to your account</td>
                </tr>
                <tr>
                  <td>Apple, Google</td>
                  <td>Sign in with Apple or Google, resolving place names, app stores</td>
                  <td>Data needed to sign in; position or place name</td>
                </tr>
                <tr>
                  <td>Expo</td>
                  <td>Delivering app updates</td>
                  <td>Technical device data, IP address</td>
                </tr>
                <tr>
                  <td>Vercel</td>
                  <td>Hosting of this website and the admin panel (Frankfurt region)</td>
                  <td>IP address and technical data in logs</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Authorised members of our team also have access to data, to the extent needed to run the app,
            investigate errors and answer requests. If you use the human coach conversation, your messages
            and training data are seen by the assigned coach and by the people who run that service on our
            side.
          </p>
          <p>
            We may disclose data to public authorities where the law requires it. We do not sell data or
            share it with advertisers.
          </p>
        </>
      ),
    },
    {
      id: "transfers",
      title: "Transfers outside the European Economic Area",
      body: (
        <>
          <p>
            App data is stored in the European Union. Some providers (Anthropic, Supabase, Vercel, Expo,
            Apple, Google, Strava) are based in the United States and may process data there. Such transfers
            rely on a European Commission adequacy decision (the EU–US Data Privacy Framework) or on standard
            contractual clauses. Open-Meteo operates in Switzerland, which the European Commission has
            recognised as providing adequate protection.
          </p>
          <p>We will provide a copy of the safeguards on request.</p>
        </>
      ),
    },
    {
      id: "retention",
      title: "How long we keep data",
      body: (
        <>
          <ul>
            <li>
              <strong>Account data, plan, workouts, conversations, health data:</strong> until you delete
              your account.
            </li>
            <li>
              <strong>Strava activities:</strong> until you disconnect Strava, delete the activity in Strava
              or delete your account.
            </li>
            <li>
              <strong>Content of AI calls in our logs:</strong> 30 days.
            </li>
            <li>
              <strong>Approximate location:</strong> together with the workout the forecast is for; it is
              overwritten each time the weather refreshes.
            </li>
            <li>
              <strong>Consent log:</strong> until you delete your account.
            </li>
            <li>
              <strong>Record of account deletion</strong> (e-mail address and date): up to 6 years, in case
              of legal claims and to show that the request was fulfilled.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "rights",
      title: "Your rights",
      body: (
        <>
          <p>You have the right to:</p>
          <ul>
            <li>access your data and receive a copy,</li>
            <li>have your data corrected – most of it you can change yourself in the app,</li>
            <li>have your data erased,</li>
            <li>restrict processing,</li>
            <li>data portability (you will receive your data in a machine-readable file),</li>
            <li>object to processing based on our legitimate interest,</li>
            <li>withdraw your health data consent at any time.</li>
          </ul>
          <p>
            To exercise these rights, write to us <Contact lang="en" />. We reply without undue delay and
            within one month at the latest. We may ask you to confirm that you are writing from the address
            linked to your account.
          </p>
          <p>
            You can also lodge a complaint with the Polish supervisory authority, Prezes Urzędu Ochrony
            Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, Poland, uodo.gov.pl), or with the authority in
            the EU country where you live.
          </p>
        </>
      ),
    },
    {
      id: "deletion",
      title: "Deleting your account",
      body: (
        <>
          <p>
            You can delete your account in two ways:
          </p>
          <ul>
            <li>
              <strong>in the app:</strong> Profile → Delete account. Your account and all related data are
              deleted right away;
            </li>
            <li>
              <strong>by e-mail:</strong> write to us <Contact lang="en" /> from the e-mail address linked to
              the account – we delete it within 30 days.
            </li>
          </ul>
          <p>
            We delete the account and all related data – plan, workouts, check-ins, conversations, Strava
            activities and records of AI calls. Only the record of deletion (e-mail address and date) described
            in section 10 remains.
          </p>
          <p>
            When you delete your account in the app, we also revoke the app’s access to your Strava account and,
            if you sign in with Apple, revoke the link to your Apple ID. You can also revoke access yourself in
            your Strava, Apple ID or Google account settings.
          </p>
        </>
      ),
    },
    {
      id: "security",
      title: "How we protect data",
      body: (
        <>
          <ul>
            <li>Connections to the app and website are encrypted (TLS), and the database is encrypted at rest.</li>
            <li>Database access rules ensure each person sees only their own data in the app.</li>
            <li>AI service keys and Strava tokens are kept on the server only, never in the app.</li>
            <li>Only authorised people have access to the admin panel.</li>
          </ul>
        </>
      ),
    },
    {
      id: "age",
      title: "Age",
      body: (
        <p>
          The app is intended for adults. It is not directed at children and we do not knowingly collect
          their data. If you believe a minor has created an account, write to us and we will delete it.
        </p>
      ),
    },
    {
      id: "website",
      title: "This website and cookies",
      body: (
        <p>
          The website uses no cookies, analytics tools or tracking scripts. The server it runs on records the
          IP address and technical browser data in its logs, which is needed to keep it secure. The mobile
          app stores your sign-in session and settings (chosen place, theme) on your phone.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <p>
          We update this policy when the app or the law changes. We will tell you about material changes in
          the app or by e-mail before they take effect. If a change requires new consent, we will ask for it.
        </p>
      ),
    },
  ],
};
