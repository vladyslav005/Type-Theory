import type {ProofTree} from "@/application/typecheck/ProofTree.ts";

export abstract class ProofTreeVisitor<R> {

  visit(node: ProofTree): R {
    switch (node.rule) {


      /* ===== Terms ===== */
      case "Var":
        return this.visitVar(node)
      case "Abs":
        return this.visitAbs(node)
      case "App":
      // TPiApp (System λP) shares App's rendering; TexMapper picks the T-App vs T-PiApp label.
      case "TPiApp":
        return this.visitApp(node)
      case "Lit":
        return this.visitLit(node)
      case "If":
        return this.visitIfCondition(node)
      case "Inl":
        return this.visitInl(node)
      case "Inr":
        return this.visitInr(node)
      case "Case":
        return this.visitCase(node)
      case "VariantCase":
        return this.visitVariantCase(node)
      case "Variant":
        return this.visitVariant(node)
      case "Ascribe":
        return this.visitAscribe(node)
      case "Tuple":
        return this.visitTuple(node)
      case "TupleProjection":
        return this.visitTupleProjection(node)
      case "Record":
        return this.visitRecord(node)
      case "RecordProjection":
        return this.visitRecordProjection(node)
      case "Sequencing":
        return this.visitSequencing(node)
      case "DummyAbs":
        return this.visitDummyAbstraction(node)
      case "BinOp":
        return this.visitBinOp(node)
      case "Fix":
        return this.visitFix(node)
      case "Let":
        return this.visitLet(node)
      case "TypeAbs":
        return this.visitTypeAbstraction(node)
      case "TypeApp":
        return this.visitTypeApplication(node)
      case "Nil":
        return this.visitNil(node)
      case "Cons":
        return this.visitCons(node)
      case "IsNil":
        return this.visitIsNil(node)
      case "Head":
        return this.visitHead(node)
      case "Tail":
        return this.visitTail(node)
      case "Fold":
        return this.visitFold(node)
      case "Unfold":
        return this.visitUnfold(node)
      case "Succ":
      case "Pred":
      case "IsZero":
        return this.visitNblOp(node)


      default:
        throw new Error("Unknown AST node: " + node.rule)
    }
  }

  /* ===== AST nodes ===== */
  protected abstract visitVar(node: ProofTree): R

  protected abstract visitAbs(node: ProofTree): R

  protected abstract visitApp(node: ProofTree): R

  protected abstract visitLit(node: ProofTree): R

  protected abstract visitIfCondition(node: ProofTree): R

  protected abstract visitInl(node: ProofTree): R

  protected abstract visitInr(node: ProofTree): R

  protected abstract visitCase(node: ProofTree): R

  protected abstract visitVariantCase(node: ProofTree): R

  protected abstract visitVariant(node: ProofTree): R

  protected abstract visitAscribe(node: ProofTree): R

  protected abstract visitTuple(node: ProofTree): R

  protected abstract visitTupleProjection(node: ProofTree): R

  protected abstract visitRecord(node: ProofTree): R

  protected abstract visitRecordProjection(node: ProofTree): R

  protected abstract visitSequencing(node: ProofTree): R

  protected abstract visitDummyAbstraction(node: ProofTree): R

  protected abstract visitBinOp(node: ProofTree): R

  protected abstract visitFix(node: ProofTree): R

  protected abstract visitLet(node: ProofTree): R

  protected abstract visitTypeAbstraction(node: ProofTree): R

  protected abstract visitTypeApplication(node: ProofTree): R

  /* ===== Lists (Lecture 06) ===== */
  protected abstract visitNil(node: ProofTree): R

  protected abstract visitCons(node: ProofTree): R

  protected abstract visitIsNil(node: ProofTree): R

  protected abstract visitHead(node: ProofTree): R

  protected abstract visitTail(node: ProofTree): R

  /* ===== Iso-recursive types (Lecture 06) ===== */
  protected abstract visitFold(node: ProofTree): R

  protected abstract visitUnfold(node: ProofTree): R

  protected abstract visitNblOp(node: ProofTree): R

}
