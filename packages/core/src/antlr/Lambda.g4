grammar Lambda;

expression
    : ( globalDecl )* (term SEMI)? EOF              # Expr
    ;


globalDecl
    : ID COLON type SEMI                      # GlobalVariableDeclaration
    | ID EQ term COLON type SEMI           # GlobalFunctionDeclaration
    | ID EQ term SEMI                          # UntypedGlobalFunctionDeclaration
    | TYPEDEF ID EQ type SEMI                 # TypeAliasDeclaration
    | TYPEDEF ID COLON kind SEMI               # TypeConstructorDeclaration
    ;

term
    // 1. Postfix operations: highest priority
    : term DOT NATURAL_NUMBER                                                        # TupleProjection
    | term DOT ID                                                                    # RecordProjection

    // 2. Application: term application and type application (System F)
    // share this precedence tier, left-associative, so "t u [T] v" parses
    // as "((t u) [T]) v".
    | term term                                                                      # Application
    | term LBRACK type RBRACK                                                        # TypeApplication

    // 3. Arithmetic and comparison: all in one rule/alternative, same
    // precedence, left-associative (e.g. "1 + 2 * 3" parses as "(1+2)*3").
    | term op=(PLUS|MINUS|MUL|DIV|LT|MT|LEQ|GEQ|EQEQ|NEQ) term                       # BinaryOp

    // 4. Type ascription: lower than application
    | term AS type                                                                   # Ascribe

    // 5. Sequencing: lowest priority
    | <assoc=right> term SEMI term                                                   # Sequencing

    // 6. Prefix / complex terms: keyword-led forms whose body extends
    // maximally to the right, so relative order among them doesn't matter.
    | LAMBDA UNDERSCORE COLON type DOT term                                          # DummyAbstraction
    | LAMBDA ID COLON type DOT term                                                  # LambdaAbstraction
    | LAMBDA ID DOT term                                                             # LambdaAbstractionUntyped
    | LAMBDA_CAPITALIZED typeVariable DOT term                                       # TypeAbstraction
    | LET ID EQ term IN term                                                         # LetExpression
    | IF term THEN term (ELSEIF term THEN term)* (ELSE term)?                        # IfCondition
    | CASE term OR INL ID DOUBLEARROW term OR INR ID DOUBLEARROW term                # Case
    | CASE term OF LBRACK ID EQ ID RBRACK DOUBLEARROW term (OR LBRACK ID EQ ID RBRACK DOUBLEARROW term)*     # VariantCase
    | INL term AS type                                                               # Inl
    | INR term AS type                                                               # Inr
    | FIX term                                                                       # Fix
    | NIL LBRACK type RBRACK                                                         # Nil
    | CONS LBRACK type RBRACK term term                                              # Cons
    | ISNIL LBRACK type RBRACK term                                                  # IsNil
    | HEAD LBRACK type RBRACK term                                                   # Head
    | TAIL LBRACK type RBRACK term                                                   # Tail
    | FOLD LBRACK type RBRACK term                                                   # Fold
    | UNFOLD LBRACK type RBRACK term                                                 # Unfold

    // 7. Atomic / grouped terms
    | LT ID EQ term (COMMA ID EQ term)* MT                                           # Record
    | LT term (COMMA term)* MT                                                       # Tuple
    | LBRACK ID EQ term (COMMA ID EQ term)* RBRACK AS type                           # Variant
    | ID                                                                             # Variable
    | LPAREN term RPAREN                                                             # Parentheses
    | constant                                                                       # Literal
    ;

type
    // 1. Type constructor application (System λω̲) and dependent-type index
    // application (System λP) share this precedence tier: highest
    // priority, left-associative. "List Nat" applies the type constructor
    // List to the type Nat; "Vec[n]" applies the (dependently-kinded) type
    // constructor Vec to the term index n — bracketed so it never clashes
    // with plain juxtaposition, mirroring the term-level "t [T]" (System F
    // type application) bracket syntax.
    : type type                                                  # TypeConstructorApplication
    | type LBRACK term RBRACK                                    # TypeIndexApplication
    | LIST type                                                  # ListType

    // 2. Sum type has higher priority than arrow
    | type PLUS type                                             # SumType

    // 3. Arrow type is lowest operator precedence, right-associative
    | <assoc=right> type ARROW type                              # FunctionType

    // 4. Prefix / binder types: body extends maximally to the right, so
    // "forall X. X -> X" is "forall X. (X -> X)". Type constructor
    // abstraction reuses the same λ as term-level abstraction (System λω̲
    // uses one binder at every level) — its parameter is a kind, not a
    // type, so it's never ambiguous with LambdaAbstraction (that rule only
    // ever appears where a term is expected). Π (System λP) binds a *term*
    // variable over a type — "Π x:A. B" — of which "A -> B" is the
    // non-dependent special case (x not free in B).
    | FORALL typeVariable DOT type                               # ForallType
    | LAMBDA typeVariable COLON kind DOT type                    # TypeConstructorAbstraction
    | PI ID COLON type DOT type                                  # PiType
    | MU typeVariable DOT type                                   # RecursiveType

    // 5. Atomic / grouped types
    | LT type (MUL type)* MT                                     # TupleType
    | LBRACK ID COLON type (COMMA ID COLON type)* RBRACK         # VariantType
    | LPAREN type RPAREN                                         # ParenType
    | (GREEK | ID | 'Nat' | 'Bool' | 'Unit' | 'String')          # TypeIdentifier
    ;

typeVariable
    :  GREEK | ID
    ;

constant
    : NATURAL_NUMBER | '0'
    | 'true'
    | 'True'
    | 'false'
    | 'False'
    | 'Unit'
    | 'unit'
    | STRING_LITERAL
    ;

kind
    : KIND_STAR                                 # StarKind
    | <assoc=right> kind ARROW kind             # KindArrow
    // System λP: a kind can be indexed by an ordinary type rather than
    // another kind, e.g. "Nat -> @" — the kind of a type constructor that
    // takes a *term* of type Nat and produces a type.
    | <assoc=right> type ARROW kind             # DependentKindArrow
    | LPAREN kind RPAREN                        # ParenKind
    ;


LAMBDA         : 'λ' | '\\' ;

LAMBDA_CAPITALIZED     : 'Λ';
LET            : 'let';
IN             : 'in';
FIX            : 'fix';
TYPEDEF        : 'typedef';

NIL            : 'nil';
CONS           : 'cons';
ISNIL          : 'isnil';
HEAD           : 'head';
TAIL           : 'tail';
LIST           : 'List';

FOLD           : 'fold';
UNFOLD         : 'unfold';
MU             : 'μ';

KIND_STAR      : '@'; // to avoid ambiguity with, '@' is used instead of '*' for the kind of types

APOSTROPHE     : '\'';

FORALL         : '∀';
PI             : 'Π';

CASE           : 'case';
OF             : 'of';

INL            : 'inl';
INR            : 'inr';
OR             : '||';
AS             : 'as';

IF             : 'if';
THEN           : 'then';
ELSEIF         : 'elseif';
ELSE           : 'else';

UNDERSCORE     : '_';

EQEQ           : '==';
NEQ            : '!=';
LEQ            : '<=';
GEQ            : '>=';
EQ             : '=';
LT             : '<';
MT             : '>';
MUL            : '*' | '×';
PLUS           : '+';
MINUS          : '-';
DIV            : '/';

LBRACK         : '[';
RBRACK         : ']';
LPAREN         : '(';
RPAREN         : ')';

COMMA          : ',';
ARROW          : '->' | '→';
DOUBLEARROW    : '=>' | '⇒';
COLON          : ':';
DOT            : '.';
SEMI           : ';';

GREEK          : [\u03B1-\u03C9];
NATURAL_NUMBER : [1-9] [0-9]*;
ZERO           : '0';

STRING_LITERAL : '"' ( '\\' . | ~["\\\r\n] )* '"';

ID             : [a-zA-Z_][a-zA-Z0-9_]*;

LINE_COMMENT
    : '//' ~[\r\n]* -> skip
    ;

WS
    : [ \t\r\n]+ -> skip
    ;