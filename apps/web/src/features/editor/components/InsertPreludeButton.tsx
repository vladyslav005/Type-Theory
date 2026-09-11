import {useTranslation} from "react-i18next";
import {Button} from "@/shared/components/ui/button.tsx";
import {Blocks} from "lucide-react";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/shared/components/ui/tooltip.tsx";

// Standard combinators for untyped lambda calculus, prepended to the editor so studying doesn't
// mean retyping tru/fls/zero/succ/... in every single snippet — plain, editable lambda-calculus
// text, not hidden engine built-ins, so it stays consistent with how every other example works.
export const PRELUDE_CODE = `// Standard combinators for untyped lambda calculus — enable "Untyped lambda
// calculus" in the Type Theories dropdown to use them. Edit or delete anything
// you don't need.

// Booleans (named "tru"/"fls" — "true"/"false" are reserved Bool literals)
tru = λ t . λ f . t;
fls = λ t . λ f . f;
not = λ b . b fls tru;
and = λ b . λ c . b c fls;
or  = λ b . λ c . b tru c;
test = λ b . λ c . λ a . b c a;   // if b then c else a

// Pairs
pair = λ f . λ s . λ b . b f s;
fst  = λ p . p tru;
snd  = λ p . p fls;

// Numerals (named "zero"/"one"/"two"/"three" — plain digits can't be identifiers)
zero  = λ s . λ z . z;
succ  = λ n . λ s . λ z . s (n s z);
one   = succ zero;
two   = succ one;
three = succ two;

plus = λ m . λ n . λ s . λ z . m s (n s z);
times = λ m . λ n . m (plus n) zero;
iszero = λ n . n (λ x . fls) tru;

// pred: run (prev, current) forward n times from (0, 0) via the classic pair trick.
shift = λ p . pair (snd p) (succ (snd p));
pred  = λ n . fst (n shift (pair zero zero));

// Recursion — Y works under Normal order/Call-by-name but diverges under
// Call-by-value; fixx is the Call-by-value-safe version, prefer it by default.
// (Named "fixx", not "fix" — plain "fix" is already a reserved builtin.)
Y = λ f . (λ x . f (x x)) (λ x . f (x x));
fixx = λ f . (λ x . f (λ y . x x y)) (λ x . f (λ y . x x y));

`;

export interface InsertPreludeButtonProps {
  onInsert: (code: string) => void;
}

export function InsertPreludeButton({onInsert}: InsertPreludeButtonProps) {
  const {t} = useTranslation();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => onInsert(PRELUDE_CODE)}
          >
            <Blocks className="h-3.5 w-3.5" />
            {t("prelude.trigger")}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("prelude.tooltip")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
