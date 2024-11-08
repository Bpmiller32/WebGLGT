import { defineComponent, ref } from "vue";

export default defineComponent({
  props: {
    setUsername: { type: Function, required: true },
    setPassword: { type: Function, required: true },
  },
  setup(props) {
    const usernameRef = ref();
    const passwordRef = ref();

    return () => (
      <div class="isolate -space-y-px rounded-md shadow-sm">
        <div class="relative rounded-md rounded-b-none px-3 pb-1.5 pt-2.5 ring-1 ring-inset ring-gray-300 focus-within:z-10 focus-within:ring-2 focus-within:ring-indigo-600 duration-300">
          <label for="name" class="block text-xs font-medium text-gray-100">
            Username
          </label>
          <input
            ref={usernameRef}
            type="text"
            class="block bg-[#211d20] w-full border-0 p-0 text-gray-100 placeholder:text-gray-400 focus:ring-0"
            placeholder="username"
            onChange={() => {
              props.setUsername(usernameRef.value.value);
            }}
          />
        </div>
        <div class="relative rounded-md rounded-t-none px-3 pb-1.5 pt-2.5 ring-1 ring-inset ring-gray-300 focus-within:z-10 focus-within:ring-2 focus-within:ring-indigo-600 duration-300">
          <label
            for="job-title"
            class="block text-xs font-medium text-gray-100"
          >
            Password
          </label>
          <input
            ref={passwordRef}
            type="password"
            class="block bg-[#211d20] w-full border-0 p-0 text-gray-100 placeholder:text-gray-400 focus:ring-0"
            placeholder="**********"
            onChange={() => {
              props.setUsername(passwordRef.value.value);
            }}
          />
        </div>
      </div>
    );
  },
});
