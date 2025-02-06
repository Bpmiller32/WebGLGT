import { defineComponent } from "vue";
import webGlGtLogo from "../../assets/webGLGT.webp";
import groundTruth2Logo from "../../assets/groundTruth2Logo.webp";

export default defineComponent({
  setup() {
    const imgSrc =
      import.meta.env.VITE_ISDEMO === "true" ? webGlGtLogo : groundTruth2Logo;

    return () => (
      <div class="mb-5 flex justify-center select-none cursor-default">
        <img src={imgSrc} class="h-8" alt="logo" />
      </div>
    );
  },
});
