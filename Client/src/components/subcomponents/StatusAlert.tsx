import { defineComponent, PropType } from "vue";
import { JSX } from "vue/jsx-runtime";

// Define the component
export default defineComponent({
  props: {
    // The color of the status alert
    statusAlertColor: {
      type: String as PropType<string | undefined>,
      required: true,
    },
    // The text to display in the alert
    statusAlertText: {
      type: String as PropType<string | undefined>,
      required: true,
    },
    // The configuration for the status alert based on color
    statusAlertConfig: {
      type: Object as () => {
        [key: string]: {
          container: string;
          text: string;
          icon: JSX.Element;
        };
      },
      required: true,
    },
  },
  setup(props) {
    // Deconstruct props to get rid of undefined's
    const { statusAlertColor, statusAlertText, statusAlertConfig } = props;

    // If there's no config for the given color, return null (do not render)
    if (!statusAlertColor) {
      return null;
    }

    const { container, text, icon } = statusAlertConfig[statusAlertColor];

    return () => (
      <div class={`rounded-md p-3 ${container}`}>
        <div class="flex">
          <div class="flex-shrink-0">{icon}</div>
          <div class="ml-3">
            <p class={`text-sm font-medium ${text}`}>{statusAlertText || ""}</p>
          </div>
        </div>
      </div>
    );
  },
});
