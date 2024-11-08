import Emitter from "../eventEmitter";
import { defineComponent, onMounted, ref } from "vue";
import { pingServer } from "./apiHandler";
import { db } from "../firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import AppLogo from "./subcomponents/appLogo";
import ServerStatusBadge from "./subcomponents/serverStatusBadge";
import UserPassInputs from "./subcomponents/userPassInputs";

export default defineComponent({
  props: {
    apiUrl: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    /* ------------------------ Component state and setup ----------------------- */
    // Template refs
    const username = ref("");
    const password = ref("");

    const isServerOnline = ref(false);
    const isButtonEnabled = ref(true);
    const didLoginFail = ref(false);
    const isDebugEnabled = ref(false);

    onMounted(async () => {
      // Get status of BE server
      // TODO: remove
      setTimeout(() => {
        isServerOnline.value = true;
      }, 2000);
      // isServerOnline.value = await pingServer(props.apiUrl);

      // Check if the URL ends with #debug
      if (window.location.hash === "#debug") {
        isDebugEnabled.value = true;
      }
    });

    /* ----------------------------- Template events ---------------------------- */
    const StartAppButtonClicked = async () => {
      // Debug, TODO: remove
      // Emitter.emit("startApp");
      console.log(username.value);
      return;

      // Firebase login check
      try {
        // Get a reference to the document
        const docRef = doc(db, "logins", username.value.value);

        // Fetch the document
        const docSnap = await getDoc(docRef);

        // Check the loginPage password against the firebase value
        const document = docSnap.data()!;

        if (password.value.value !== document.password) {
          throw new Error();
        }

        Emitter.emit("startApp");
        isButtonEnabled.value = false;
      } catch {
        didLoginFail.value = true;
        console.error("Username or password incorrect");

        // Trigger again if already failed one login
        if (didLoginFail.value === true) {
          const loginErrorLabelElement =
            document.getElementById("loginErrorLabel");
          loginErrorLabelElement?.classList.remove("animate-shake");

          setTimeout(() => {
            loginErrorLabelElement?.classList.add("animate-shake");
          }, 100);
        }
      }
    };

    const DebugButtonClicked = async () => {
      try {
        // Reference the collection
        const collectionRef = collection(db, "tjxImageData");

        // Fetch all documents from the collection
        const querySnapshot = await getDocs(collectionRef);

        // Iterate through each document and inspect the specific property
        let totalCount = 0;
        const times: number[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const timeOnImage = data["timeOnImage"];

          totalCount++;
          times.push(timeOnImage);
        });

        const sortedNumbers = [...times].sort((a, b) => a - b);
        const n = sortedNumbers.length;
        const mid = Math.floor(n / 2);
        let medianTime = 0;

        if (n % 2 === 0) {
          // If even, average the two middle numbers
          medianTime = (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2;
        } else {
          // If odd, return the middle number
          medianTime = sortedNumbers[mid];
        }

        console.log(
          `Total images processed: ${totalCount}, Median time: ${medianTime}`
        );
      } catch {
        console.error("Error fetching documents from firestore");
      }
    };

    /* ------------------------------ Subcomponents ----------------------------- */

    const DebugButton = () => {
      if (isDebugEnabled.value) {
        return (
          <button
            onClick={() => DebugButtonClicked()}
            class="flex items-center w-fit py-2 px-3 rounded-l-xl rounded-r-xl border border-white/50 group hover:border-indigo-600 duration-300"
          >
            <p class="text-white text-sm group-hover:text-indigo-200 duration-300">
              Debug
            </p>
          </button>
        );
      } else {
        return <div></div>;
      }
    };

    const LoginErrorLabel = () => {
      if (didLoginFail.value) {
        return (
          <div class="justify-self-end flex items-center">
            <label
              id="loginErrorLabel"
              class="text-sm text-red-500 animate-shake"
            >
              Login failed
            </label>
            ;
          </div>
        );
      }
    };

    const StartAppButton = () => {
      if (isServerOnline.value && isButtonEnabled.value) {
        return (
          <button
            type="button"
            onClick={() => StartAppButtonClicked()}
            class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 duration-300"
          >
            Start App
          </button>
        );
      } else {
        return (
          <button
            type="button"
            class="cursor-not-allowed rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm"
          >
            Start App
          </button>
        );
      }
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <article class="w-screen h-screen flex justify-center items-center">
        <section>
          {/* App logo */}
          <AppLogo />

          {/* Server status */}
          <div class="flex justify-end">
            <ServerStatusBadge isServerOnline={isServerOnline.value} />
          </div>

          {/* Username and pass input fields */}
          <UserPassInputs
            setUsername={(newUsername: string) =>
              (username.value = newUsername)
            }
            setPassword={(newPassword: string) => {
              password.value = newPassword;
            }}
          />

          {/* Start app button and optional login failed */}
          <div class="grid grid-cols-3 justify-between mt-2">
            {DebugButton()}
            {StartAppButton()}
            {LoginErrorLabel()}
          </div>
        </section>
      </article>
    );
  },
});
