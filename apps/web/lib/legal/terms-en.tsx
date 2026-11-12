import { Contact, OperatorAddress } from "@/components/legal/contact";
import type { LegalDocument } from "@/components/legal/legal-page";
import { legalPath } from "@/lib/content";

export const termsEn: LegalDocument = {
  title: "Terms of Service",
  lead: (
    <p>
      These terms set out the rules for using the Aloha App mobile app and this website. By creating an
      account you enter into a contract with us on the terms below. Please read section 5 on health and
      safety in particular.
    </p>
  ),
  sections: [
    {
      id: "provider",
      title: "Who we are",
      body: (
        <>
          <p>Aloha App is provided, and the services are supplied, by:</p>
          <OperatorAddress lang="en" />
          <p>
            The company is entered in the register of entrepreneurs of the Polish National Court Register
            (KRS). In these terms we call it “we” and the person using the app “you”. You can contact us{" "}
            <Contact lang="en" />.
          </p>
        </>
      ),
    },
    {
      id: "services",
      title: "What Aloha App offers",
      body: (
        <>
          <p>Aloha App is an app for amateur runners. Through it we provide the following electronic services:</p>
          <ul>
            <li>a user account,</li>
            <li>a running plan built from your survey and adjusted week by week,</li>
            <li>a daily check-in and suggestions for a lighter workout,</li>
            <li>a weather forecast and a suggested best time to run,</li>
            <li>importing runs from Strava and reviewing a workout against the plan,</li>
            <li>notes from and conversations with the AI coach,</li>
            <li>conversations with a human coach – in selected plans.</li>
          </ul>
          <p>
            The features available may depend on your plan, app version and operating system. We keep
            developing the app, so features may change; we will give notice under section 14 of changes that
            materially reduce what you use.
          </p>
        </>
      ),
    },
    {
      id: "requirements",
      title: "Technical requirements",
      body: (
        <ul>
          <li>a phone running the iOS or Android version stated on the app’s store page,</li>
          <li>internet access,</li>
          <li>an active e-mail address, or an Apple or Google account,</li>
          <li>for optional features: a Strava account, system permission for location.</li>
        </ul>
      ),
    },
    {
      id: "account",
      title: "Your account and the contract",
      body: (
        <>
          <ul>
            <li>You must be at least 18 years old to use the app.</li>
            <li>
              You create an account by giving an e-mail address and password, or by signing in with Apple or
              Google, and by accepting these terms and the <a href={legalPath.privacy.en}>Privacy Policy</a>.
            </li>
            <li>The contract for using the app is concluded when the account is created, for an indefinite period.</li>
            <li>
              Give accurate details, keep your password safe and do not share your account. One person, one
              account.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "health",
      title: "Health and safety",
      body: (
        <>
          <div className="callout">
            <p>
              <strong>
                Aloha App is not a medical device and does not replace a doctor or a physiotherapist. The
                plan, proposed changes and the coach’s answers – including the AI coach’s – are training
                guidance, not medical advice or a diagnosis.
              </strong>
            </p>
          </div>
          <ul>
            <li>
              Before you start training, make sure your health allows it. If you have a chronic condition or
              an injury, are pregnant, are returning after a long break or have any doubts, talk to a doctor
              first.
            </li>
            <li>
              Stop training and seek medical help if you feel chest pain, shortness of breath, dizziness,
              faintness or sharp pain. In an emergency call 112 or your local emergency number.
            </li>
            <li>
              The plan is built from what you tell us. Answer the survey and check-in truthfully – whether
              the training load is sensible for you depends on it.
            </li>
            <li>
              You decide whether and how to do a workout. Adapt it to how you feel, the weather and the
              conditions on your route, and follow traffic rules when you run.
            </li>
            <li>
              The weather forecast and suggested running time are indicative and may differ from actual
              conditions.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "coach",
      title: "The AI coach and the human coach",
      body: (
        <>
          <ul>
            <li>
              The AI coach is software based on language models. Its answers are generated automatically and
              may contain errors. Treat them as a suggestion, not an instruction.
            </li>
            <li>
              Changes to your plan are proposals: they take effect only once you accept them, and you can
              always keep the plan as it is.
            </li>
            <li>
              The number of messages to the AI coach is limited (currently 40 per day) so that the service
              runs smoothly for everyone.
            </li>
            <li>
              The human coach replies within a reasonable time, not instantly. It is not a medical service or
              emergency help.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "integrations",
      title: "Strava and other third-party services",
      body: (
        <>
          <p>
            Some features rely on services from other companies: Strava, the weather forecast provider
            (Open-Meteo), and Apple and Google sign-in. When you use them, their own terms apply as well. We
            are not responsible for their outages or for changes that limit access to data; in that case a
            feature may work less well or be switched off.
          </p>
          <p>
            Strava is a trademark of Strava, Inc. Aloha App is not a Strava product and is not sponsored by
            Strava.
          </p>
        </>
      ),
    },
    {
      id: "fees",
      title: "Fees",
      body: (
        <>
          <p>
            Creating an account and using the app is currently free. You bear the cost of your internet
            connection under your operator’s tariff.
          </p>
          <p>
            We may introduce paid plans in the future. Before you pay anything we will show the price, what
            is included and how renewal works, and a purchase will require your explicit confirmation. We
            will not charge you anything without it.
          </p>
        </>
      ),
    },
    {
      id: "rules",
      title: "Rules of use",
      body: (
        <>
          <p>Use the app lawfully and for its intended purpose. In particular you must not:</p>
          <ul>
            <li>
              send content that is unlawful, abusive or infringes other people’s rights, or other people’s
              personal data – this also applies to coach conversations,
            </li>
            <li>try to access other people’s data or get around security measures and limits,</li>
            <li>copy, decompile or reverse engineer the app beyond what the law allows,</li>
            <li>extract data automatically or use the app to build a competing service,</li>
            <li>resell access to the app or use it commercially without our consent.</li>
          </ul>
          <p>
            If you seriously or persistently break these rules, we may, after first asking you to stop,
            restrict access to features or terminate the contract (section 13). You can report unlawful
            content to our contact address; we handle reports without undue delay.
          </p>
        </>
      ),
    },
    {
      id: "ip",
      title: "Rights in the app and in your content",
      body: (
        <>
          <p>
            The app, its code, design, texts and marks belong to us or our licensors. For the duration of the
            contract we grant you a non-exclusive, non-transferable licence to use the app for your own
            non-commercial purposes.
          </p>
          <p>
            The content you enter (answers, messages, results) remains yours. You allow us to process it as
            far as needed to run the app. You are free to use the training plan built for you for your own
            needs.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "Availability and liability",
      body: (
        <>
          <ul>
            <li>
              We work to keep the app running without interruption but do not guarantee continuous
              availability. Technical breaks, failures and maintenance may occur.
            </li>
            <li>We do not promise any particular sporting result. A race time forecast is an estimate, not a guarantee.</li>
            <li>
              We are not liable for the consequences of giving untrue information about yourself, or of using
              the app contrary to these terms and the guidance in section 5.
            </li>
            <li>Towards people who are not consumers, our liability is limited to damage caused intentionally.</li>
          </ul>
          <p>
            Nothing in these terms excludes or limits consumer rights under mandatory law, including
            liability for personal injury and for damage caused intentionally.
          </p>
        </>
      ),
    },
    {
      id: "complaints",
      title: "Complaints",
      body: (
        <>
          <p>
            If the app does not work as it should, write to us <Contact lang="en" />. Give your account
            e-mail address, a description of the problem and what you expect. We will reply within 14 days.
          </p>
          <p>
            As a consumer you have rights where a digital service is not in conformity with the contract, as
            set out in the Polish Consumer Rights Act. You can also use out-of-court dispute resolution, for
            example the help of a municipal or district consumer ombudsman or a regional Trade Inspection
            office in Poland. We are not obliged to take part in such proceedings and will decide whether to
            agree once we receive a request.
          </p>
        </>
      ),
    },
    {
      id: "termination",
      title: "Withdrawal and termination",
      body: (
        <>
          <ul>
            <li>
              <strong>Leave at any time.</strong> You can end the contract without giving a reason and at no
              cost by asking us to delete your account. The{" "}
              <a href={`${legalPath.privacy.en}#deletion`}>Privacy Policy</a> explains how.
            </li>
            <li>
              <strong>Withdrawal.</strong> As a consumer you can also withdraw from the contract within 14
              days of creating your account, without giving a reason. A message with a clear statement, sent
              before the deadline, is enough.
            </li>
            <li>
              <strong>Termination by us.</strong> We may terminate the contract with 30 days’ notice if we
              stop providing the service, or with 7 days’ notice if you keep breaking these terms after being
              asked to stop. We will tell you by e-mail. During that time you can ask for a copy of your
              data.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: (
        <>
          <p>We may change these terms for good reason:</p>
          <ul>
            <li>a change in the law or a decision of an authority that affects the service,</li>
            <li>new features, or changes to or withdrawal of existing ones, including the introduction of paid plans,</li>
            <li>security reasons or changes on the side of the providers we rely on,</li>
            <li>a change in our company details.</li>
          </ul>
          <p>
            We will tell you about a change in the app or by e-mail at least 14 days before it takes effect.
            If you do not agree, you can end the contract before that date by deleting your account. A change
            does not affect rights you acquired earlier.
          </p>
        </>
      ),
    },
    {
      id: "law",
      title: "Governing law and disputes",
      body: (
        <>
          <p>
            The contract is governed by Polish law. If you are a consumer living in another European Union
            country, you keep the protection given by the mandatory rules of your country.
          </p>
          <p>
            Disputes with consumers are decided by the court that has jurisdiction under the general rules.
            Disputes with anyone else are decided by the court for our registered office.
          </p>
          <p>
            These terms were written in Polish and English. If the two versions differ, the Polish version
            prevails, unless mandatory consumer law says otherwise.
          </p>
          <p>
            How we process personal data is described in the <a href={legalPath.privacy.en}>Privacy Policy</a>.
          </p>
        </>
      ),
    },
  ],
};
