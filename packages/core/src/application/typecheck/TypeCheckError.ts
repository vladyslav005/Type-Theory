import type {SourcePosition} from "@/domain/ast";

export class TypeCheckError extends Error {
  // Where to switch on the construct the message is about, shown separately from the message.
  constructor(message: string, public readonly pos?: SourcePosition, public readonly hint?: string) {
    super(message);
    this.name = "TypeCheckError";
  }
}
