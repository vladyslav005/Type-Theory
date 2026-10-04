import {Callout, Math, MathBlock, TryItBox} from "@/features/docs/lectures/blocks/LectureBlocks.tsx";
import {mdxComponents} from "@/features/docs/lectures/mdxComponents.tsx";
import {LambdaTask} from "@/features/docs/labs/components/LambdaTask.tsx";
import {NblTask} from "@/features/docs/labs/components/NblTask.tsx";
import {NblTerms} from "@/features/docs/labs/components/NblTerms.tsx";
import {TypingTask} from "@/features/docs/labs/components/TypingTask.tsx";

// Everything a lab .mdx file may use without importing anything.
export const labMdxComponents = {
  ...mdxComponents,
  NblTerms,
  NblTask,
  LambdaTask,
  TypingTask,
  Callout,
  Math,
  MathBlock,
  TryItBox,
};
