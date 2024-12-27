import { defineComponent, ref, PropType } from "vue";

export default defineComponent({
  props: {
    setUsername: {
      type: Function as PropType<(newUsername: string) => string>,
      required: true,
    },
    setPassword: {
      type: Function as PropType<(newPassword: string) => string>,
      required: true,
    },
  },
  setup(props) {
    // Refs for input fields
    const usernameRef = ref<HTMLInputElement | null>(null);
    const passwordRef = ref<HTMLInputElement | null>(null);

    /* ------------------------------ Subcomponents ----------------------------- */
    const UsernameInput = () => {
      return (
        <div class="relative rounded-md rounded-b-none px-3 pb-1.5 pt-2.5 ring-1 ring-inset ring-gray-300 focus-within:z-10 focus-within:ring-2 focus-within:ring-indigo-600 duration-300">
          <label for="username" class="block text-xs font-medium text-gray-100">
            Username
          </label>
          <input
            ref={usernameRef}
            id="username"
            type="text"
            class="block bg-[#211d20] w-full border-0 p-0 text-gray-100 placeholder:text-gray-400 focus:ring-0"
            placeholder="username"
            onInput={() => {
              if (usernameRef.value) {
                props.setUsername(usernameRef.value.value);
              }
            }}
          />
        </div>
      );
    };

    const PasswordInput = () => {
      return (
        <div class="relative rounded-md rounded-t-none px-3 pb-1.5 pt-2.5 ring-1 ring-inset ring-gray-300 focus-within:z-10 focus-within:ring-2 focus-within:ring-indigo-600 duration-300">
          <label for="password" class="block text-xs font-medium text-gray-100">
            Password
          </label>
          <input
            ref={passwordRef}
            id="password"
            type="password"
            class="block bg-[#211d20] w-full border-0 p-0 text-gray-100 placeholder:text-gray-400 focus:ring-0"
            placeholder="**********"
            onInput={() => {
              if (passwordRef.value) {
                props.setPassword(passwordRef.value.value);
              }
            }}
          />
        </div>
      );
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <div class="isolate -space-y-px rounded-md shadow-sm">
        {UsernameInput()}
        {PasswordInput()}
      </div>
    );
  },
});
