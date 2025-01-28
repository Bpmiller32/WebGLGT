import { defineComponent, PropType, ref, watch } from "vue";

export default defineComponent({
  props: {
    didLoginFail: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    loginFailAnimationToggle: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
  },
  setup(props) {
    const toggleAnimation = ref<boolean>(false);

    watch(
      () => props.loginFailAnimationToggle,
      () => {
        // Simple toggle
        toggleAnimation.value = false;

        setTimeout(() => {
          toggleAnimation.value = true;
        }, 100);
      }
    );

    return () =>
      props.didLoginFail ? (
        <div class="flex items-center justify-self-end">
          <label
            class={[
              "text-xs text-red-500",
              toggleAnimation.value && "animate-shake",
            ]}
          >
            Login failed
          </label>
        </div>
      ) : null;
  },
});
