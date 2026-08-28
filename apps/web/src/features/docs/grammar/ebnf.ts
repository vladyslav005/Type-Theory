// Hand-transcribed from src/shared/core/antlr/Lambda.g4 — that's the source of truth if they drift.
export const EBNF_GRAMMAR = `program     ::= { global-decl } [ term ';' ]

global-decl ::= ID ':' type ';'                                  (* variable declaration *)
              | ID '=' term ':' type ';'                         (* function/value declaration *)
              | 'typedef' ID '=' type ';'                        (* type alias *)
              | 'typedef' ID ':' kind ';'                        (* opaque type constructor *)

term        ::= term '.' natural-number                          (* tuple projection *)
              | term '.' ID                                      (* record projection *)
              | term term                                        (* application *)
              | term '[' type ']'                                (* type application, System F *)
              | term ( '+' | '-' | '*' | '/'
                      | '<' | '>' | '<=' | '>=' | '==' | '!=' ) term
              | term 'as' type                                   (* ascription *)
              | term ';' term                                    (* sequencing, right-assoc *)
              | 'λ' '_' ':' type '.' term                        (* dummy abstraction *)
              | 'λ' ID ':' type '.' term                         (* abstraction *)
              | 'λ' ID '.' term                                  (* unannotated abstraction *)
              | 'Λ' type-variable '.' term                       (* type abstraction, System F *)
              | 'let' ID '=' term 'in' term
              | 'if' term 'then' term
                    { 'elseif' term 'then' term } [ 'else' term ]
              | 'case' term
                    '||' 'inl' ID '=>' term
                    '||' 'inr' ID '=>' term
              | 'case' term 'of'
                    '[' ID '=' ID ']' '=>' term
                    { '||' '[' ID '=' ID ']' '=>' term }
              | 'inl' term 'as' type
              | 'inr' term 'as' type
              | 'fix' term
              | 'nil' '[' type ']'
              | 'cons' '[' type ']' term term
              | 'isnil' '[' type ']' term
              | 'head' '[' type ']' term
              | 'tail' '[' type ']' term
              | 'fold' '[' type ']' term
              | 'unfold' '[' type ']' term
              | '<' ID '=' term { ',' ID '=' term } '>'          (* record *)
              | '<' term { ',' term } '>'                        (* tuple *)
              | '[' ID '=' term { ',' ID '=' term } ']' 'as' type (* variant *)
              | ID                                                (* variable *)
              | '(' term ')'
              | constant

type        ::= type type                                        (* type constructor application, System Fω *)
              | type '[' term ']'                                 (* term-indexed application, System λP *)
              | 'List' type
              | type '+' type                                     (* sum type *)
              | type '->' type                                    (* function type, right-assoc *)
              | '∀' type-variable '.' type                        (* forall, System F *)
              | 'λ' type-variable ':' kind '.' type                (* type constructor abstraction, Fω *)
              | 'Π' ID ':' type '.' type                           (* dependent function type, λP *)
              | 'μ' type-variable '.' type                         (* recursive type *)
              | '<' type { '*' type } '>'                          (* tuple type *)
              | '[' ID ':' type { ',' ID ':' type } ']'            (* variant type *)
              | '(' type ')'
              | type-identifier                                    (* Nat | Bool | Unit | ID | GREEK *)

type-variable ::= GREEK | ID

constant    ::= natural-number | '0'
              | 'true' | 'True' | 'false' | 'False'
              | 'Unit' | 'unit'

kind        ::= '@'                                                (* ∗ ("star"), the kind of ordinary types — spelled @ since * is the tuple separator *)
              | kind '->' kind                                     (* right-assoc *)
              | type '->' kind                                     (* dependent kind, System λP — e.g. Nat -> @ *)
              | '(' kind ')'
`;

export const EBNF_PRECEDENCE_NOTES = [
  {
    title: "Terms (highest to lowest)",
    items: [
      "Postfix: t.i, t.l",
      "Application: t u  and  t [T]  (left-associative, share one tier)",
      "Arithmetic/comparison: + - * / < > <= >= == !=  (left-associative, one tier)",
      "Ascription: t as T",
      "Sequencing: t1 ; t2  (right-associative, lowest)",
    ],
  },
  {
    title: "Types (highest to lowest)",
    items: [
      "Constructor/index application: T U,  T[t],  List T",
      "Sum: T1 + T2",
      "Arrow: T1 -> T2  (right-associative)",
      "Binders (∀, λ, Π, μ) extend as far right as possible",
    ],
  },
];
