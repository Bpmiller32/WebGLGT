import { defineComponent, PropType, ref } from "vue";

export default defineComponent({
  props: {
    didLoginFail: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
  },
  setup(props) {
    const loginErrorLabelRef = ref<HTMLElement | null>(null);

    return () =>
      props.didLoginFail ? (
        <div class="flex items-center justify-self-end">
          <label
            ref={loginErrorLabelRef}
            class="text-sm text-red-500 animate-shake"
          >
            Login failed
          </label>
        </div>
      ) : null;
  },
});
