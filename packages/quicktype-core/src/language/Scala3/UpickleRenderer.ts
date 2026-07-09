import type { Name } from "../../Naming";
import type { Sourcelike } from "../../Source";
import type { ClassType, EnumType, Type, UnionType } from "../../Type";
import {
    matchType,
    nullableFromUnion,
    removeNullFromUnion,
} from "../../Type/TypeUtils";

import { Scala3Renderer } from "./Scala3Renderer";
import { shouldAddBacktick, wrapOption } from "./utils";

export class UpickleRenderer extends Scala3Renderer {
    private seenUnionTypes: string[] = [];

    protected upickleEncoderForType(
        t: Type,
        __ = false,
        noOptional = false,
        paramName = "",
    ): Sourcelike {
        return matchType<Sourcelike>(
            t,
            (_anyType) => ["OptionPickler.writeJs(", paramName, ")"],
            (_nullType) => ["OptionPickler.writeJs(", paramName, ")"],
            (_boolType) => ["OptionPickler.writeJs(", paramName, ")"],
            (_integerType) => ["OptionPickler.writeJs(", paramName, ")"],
            (_doubleType) => ["OptionPickler.writeJs(", paramName, ")"],
            (_stringType) => ["OptionPickler.writeJs(", paramName, ")"],
            (arrayType) => [
                "OptionPickler.writeJs[",
                this.scalaType(arrayType.items),
                "].apply(",
                paramName,
                ")",
            ],
            (classType) => [
                "OptionPickler.writeJs[",
                this.scalaType(classType),
                "].apply(",
                paramName,
                ")",
            ],
            (mapType) => [
                "OptionPickler.writeJs[String,",
                this.scalaType(mapType.values),
                "].apply(",
                paramName,
                ")",
            ],
            (_) => ["OptionPickler.writeJs(", paramName, ")"],
            (unionType) => {
                const nullable = nullableFromUnion(unionType);
                if (nullable !== null) {
                    if (noOptional) {
                        return [
                            "OptionPickler.writeJs[",
                            this.nameForNamedType(nullable),
                            "]",
                        ];
                    }

                    return [
                        "OptionPickler.writeJs[Option[",
                        this.nameForNamedType(nullable),
                        "]]",
                    ];
                }

                return [
                    "OptionPickler.writeJs[",
                    this.nameForNamedType(unionType),
                    "]",
                ];
            },
        );
    }

    protected emitClassDefinitionMethods(): void {
        this.emitLine(") derives OptionPickler.ReadWriter ");
    }

    protected anySourceType(optional: boolean): Sourcelike {
        return [wrapOption("ujson.Value", optional)];
    }

    protected emitHeader(): void {
        super.emitHeader();
        const optionPickler = `object OptionPickler extends upickle.AttributeTagged :
    import upickle.default.Writer
    import upickle.default.Reader
    override implicit def OptionWriter[T: Writer]: Writer[Option[T]] =
        implicitly[Writer[T]].comap[Option[T]] {
            case None => null.asInstanceOf[T]
            case Some(x) => x
        }

    override implicit def OptionReader[T: Reader]: Reader[Option[T]] = {
        new Reader.Delegate[Any, Option[T]](implicitly[Reader[T]].map(Some(_))){
        override def visitNull(index: Int) = None
        }
    }
end OptionPickler

object JsonExt:
    val valueReader = OptionPickler.readwriter[ujson.Value]
    def badMerge[T](r1: => OptionPickler.Reader[?], rest: OptionPickler.Reader[?]*): OptionPickler.Reader[T] = valueReader.map { json =>
        var t: T | Null = null
        val stack       = Vector.newBuilder[Throwable]
        (r1 +: rest).foreach { reader =>
            if t == null then
            try
                t = OptionPickler.read[T](json, trace = true)(using reader.asInstanceOf[OptionPickler.Reader[T]])
            catch
                case exc => stack += exc
        }
        if t != null then t.nn else throw new Exception(json.toString(), stack.result().headOption.getOrElse(null))
    }

    extension [T](r: OptionPickler.Reader[T]) def widen[K >: T] = r.map(_.asInstanceOf[K])
end JsonExt
`;
        //         const singletonPickler = `given singletonStringPickler[A <: Singleton](using A <:< String): OptionPickler.ReadWriter[A] = OptionPickler.readwriter[ujson.Value].bimap[A](
        //     _.toString(),
        //     str => {
        //     str.toString().asInstanceOf[A]()
        //     }
        // )`;
        this.emitMultiline(optionPickler);
        this.ensureBlankLine();
        // this.emitMultiline(singletonPickler);
    }

    protected override emitEmptyClassDefinition(
        c: ClassType,
        className: Name,
    ): void {
        super.emitEmptyClassDefinition(c, className);
        this.emitItem(" derives OptionPickler.ReadWriter");
        this.ensureBlankLine();
    }

    protected override emitUnionDefinition(
        u: UnionType,
        unionName: Name,
    ): void {
        // function sortBy(t: Type): string {
        //     const kind = t.kind;
        //     if (kind === "class") return kind;
        //     return "_" + kind;
        // }

        this.emitDescription(this.descriptionForType(u));

        const [maybeNull, nonNulls] = removeNullFromUnion(u, false);
        const theTypes: Sourcelike[] = [];
        this.forEachUnionMember(u, nonNulls, "none", null, (_, t) => {
            theTypes.push(this.scalaType(t));
        });
        if (maybeNull !== null) {
            theTypes.push(this.nameForUnionMember(u, maybeNull));
        }

        this.emitItem(["type ", unionName, " = "]);
        theTypes.forEach((t, i) => {
            this.emitItem(i === 0 ? t : [" | ", t]);
        });
        const thisUnionType = theTypes
            .map((x) => this.sourcelikeToString(x))
            .join(" | ");

        this.ensureBlankLine();
        if (!this.seenUnionTypes.some((y) => y === thisUnionType)) {
            this.seenUnionTypes.push(thisUnionType);
            const sourceLikeTypes: Array<[Sourcelike, Type]> = [];
            this.forEachUnionMember(u, nonNulls, "none", null, (_, t) => {
                sourceLikeTypes.push([this.scalaType(t), t]);
            });
            if (maybeNull !== null) {
                sourceLikeTypes.push([
                    this.nameForUnionMember(u, maybeNull),
                    maybeNull,
                ]);
            }

            this.ensureBlankLine();
            this.emitLine([
                "given unionWriter",
                unionName,
                ": OptionPickler.Reader[",
                unionName,
                "] = JsonExt.badMerge[",
                unionName,
                "](",
            ]);
            this.indent(() => {
                sourceLikeTypes.forEach((t) => {
                    this.emitLine([
                        "summon[OptionPickler.Reader[",
                        t[0],
                        "]],",
                    ]);
                });
                this.emitLine(")");
            });
            this.ensureBlankLine();
            this.emitLine([
                "given unionReader",
                unionName,
                ": OptionPickler.Writer[",
                unionName,
                "] = OptionPickler.writer[ujson.Value].comap[",
                unionName,
                "]{ _v =>",
            ]);
            this.indent(() => {
                this.emitLine("(_v: @unchecked) match ");
                this.indent(() => {
                    sourceLikeTypes.forEach((t) => {
                        this.emitLine([
                            "case v: ",
                            t[0],
                            " => OptionPickler.write[",
                            t[0],
                            "](v)",
                        ]);
                    });
                });
            });
            this.emitLine("}");
        }
    }

    protected emitEnumDefinition(e: EnumType, enumName: Name): void {
        this.emitDescription(this.descriptionForType(e));

        let hasBlank = false;
        this.forEachEnumCase(e, "none", (_, jsonName) => {
            if (jsonName.trim() === "") {
                hasBlank = true;
            }
        });
        this.ensureBlankLine();
        if (hasBlank) {
            //console.log("enumName: " + enumName + " has blank");
            this.emitItem(["type ", enumName, ' = "" | ', enumName, "NonBlank"]);
            this.ensureBlankLine();
            this.emitLine([
                "given singleton",
                enumName,
                'Pickler[A <: "" | ',
                enumName,
                "NonBlank]: OptionPickler.ReadWriter[A] = ",
            ]);

            this.indent(() => {
                this.emitLine([
                    "OptionPickler.readwriter[ujson.Value].bimap[A](",
                ]);
                this.indent(() => {
                    this.emitLine(["_.toString(),"]);
                    this.emitLine(["str => {"]);
                    this.indent(() => {
                        this.emitLine(["val str2 = str.str"]);
                        this.emitLine(["str2 match {"]);
                        this.indent(() => {
                            this.emitLine([
                                'case _ if str2.length == 0 => "".asInstanceOf[A] ',
                            ]);
                            this.emitLine([
                                "case parseable =>",
                                enumName,
                                "NonBlank.valueOf(parseable).asInstanceOf[A] ",
                            ]);
                        });
                        this.emitLine(["}"]);
                    });
                    this.emitLine(["}"]);
                });
                this.emitLine([")"]);
            });
            this.ensureBlankLine();
            //let count = e.cases.size;
            this.ensureBlankLine();
            this.emitLine([
                "enum ",
                enumName,
                "NonBlank derives OptionPickler.ReadWriter: ",
            ]);
            this.indent(() => {
                this.forEachEnumCase(e, "none", (_, jsonName) => {
                    if (!(jsonName.trim() === "")) {
                        let strBuild = "";
                        const backticks =
                            shouldAddBacktick(jsonName) ||
                            jsonName.includes(" ") ||
                            !Number.isNaN(Number.parseInt(jsonName.charAt(0)));
                        this.emitItem(["case "]);
                        if (backticks) {
                            strBuild = strBuild + "`";
                        }

                        strBuild = strBuild + jsonName;
                        if (backticks) {
                            strBuild = strBuild + "`";
                        }

                        //                        if (--count > 0) strBuild + ",";
                        this.emitLine([strBuild]);
                    }
                });
            });
        } else {
            //console.log("enumName: " + enumName + " has non blank");
            this.emitLine([
                "enum ",
                enumName,
                " derives OptionPickler.ReadWriter: ",
            ]);

            this.indent(() => {
                this.forEachEnumCase(e, "none", (_, jsonName) => {
                    let strBuild = "";
                    const backticks =
                        shouldAddBacktick(jsonName) ||
                        jsonName.includes(" ") ||
                        !Number.isNaN(Number.parseInt(jsonName.charAt(0)));
                    this.emitItem(["case "]);
                    if (backticks) {
                        strBuild = strBuild + "`";
                    }

                    strBuild = strBuild + jsonName;
                    if (backticks) {
                        strBuild = strBuild + "`";
                    }

                    //                  if (--count > 0) strBuild + ",";
                    this.emitLine([strBuild]);
                });
            });
        }
    }
}
