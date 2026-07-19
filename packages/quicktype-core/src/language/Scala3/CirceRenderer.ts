import type { Name } from "../../Naming.js";
import type { Sourcelike } from "../../Source.js";
import {
    matchType,
    nullableFromUnion,
    removeNullFromUnion,
} from "../../Type/TypeUtils.js";
import type {
    ArrayType,
    ClassType,
    EnumType,
    MapType,
    Type,
    UnionType,
} from "../../Type/index.js";

import { Scala3Renderer } from "./Scala3Renderer.js";
import { shouldAddBacktick, wrapOption } from "./utils.js";

export class CirceRenderer extends Scala3Renderer {
    private readonly seenUnionTypes: string[] = [];

    protected circeEncoderForType(
        t: Type,
        __ = false,
        noOptional = false,
        paramName = "",
    ): Sourcelike {
        return matchType<Sourcelike>(
            t,
            (_anyType) => ["Encoder.encodeJson(", paramName, ")"],
            (_nullType) => ["Encoder.encodeNone(", paramName, ")"],
            (_boolType) => ["Encoder.encodeBoolean(", paramName, ")"],
            (_integerType) => ["Encoder.encodeLong(", paramName, ")"],
            (_doubleType) => ["Encoder.encodeDouble(", paramName, ")"],
            (_stringType) => ["Encoder.encodeString(", paramName, ")"],
            (arrayType) => [
                "Encoder.encodeSeq[",
                this.scalaType(arrayType.items),
                "].apply(",
                paramName,
                ")",
            ],
            (classType) => [
                "Encoder.AsObject[",
                this.scalaType(classType),
                "].apply(",
                paramName,
                ")",
            ],
            (mapType) => [
                "Encoder.encodeMap[String,",
                this.scalaType(mapType.values),
                "].apply(",
                paramName,
                ")",
            ],
            (enumType) => [
                "summon[Encoder[",
                this.scalaType(enumType),
                "]].apply(",
                paramName,
                ")",
            ],
            (unionType) => {
                const nullable = nullableFromUnion(unionType);
                if (nullable !== null) {
                    if (noOptional) {
                        return [
                            "Encoder.AsObject[",
                            this.nameForNamedType(nullable),
                            "]",
                        ];
                    }

                    return [
                        "Encoder.AsObject[Option[",
                        this.nameForNamedType(nullable),
                        "]]",
                    ];
                }

                return [
                    "Encoder.AsObject[",
                    this.nameForNamedType(unionType),
                    "]",
                ];
            },
        );
    }

    protected emitEmptyClassDefinition(c: ClassType, className: Name): void {
        this.emitDescription(this.descriptionForType(c));
        this.ensureBlankLine();
        this.emitLine(
            "case class ",
            className,
            "()  derives Encoder.AsObject, Decoder",
        );
    }

    protected anySourceType(optional: boolean): Sourcelike {
        return [wrapOption("Json", optional)];
    }

    protected emitClassDefinitionMethods(): void {
        this.emitLine(") derives Encoder.AsObject, Decoder");
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

        const isBlank = (str: string): boolean => !str.trim();

        if (hasBlank) {
            //console.log("enumName: " + enumName + " has blank");
            this.emitItem(["type ", enumName, ' = "" | ', enumName, "NonBlank"]);
            this.ensureBlankLine();
            this.emitLine([
                "given ",
                enumName,
                "Enc: Encoder[",
                enumName,
                "] = Encoder.encodeString.contramap(_.toString())",
            ]);
            this.emitLine([
                "given ",
                enumName,
                "Dec: Decoder[",
                enumName,
                "] = List[Decoder[",
                enumName,
                "]](",
            ]);
            this.indent(() => {
                this.emitLine('Decoder[""].widen,');
                this.emitLine(["Decoder[", enumName, "NonBlank].widen"]);
            });
            this.emitLine(").reduceLeft(_ or _)");

            this.ensureBlankLine();
            //let count = e.cases.size;
            this.ensureBlankLine();
            this.emitLine(["enum ", enumName, "NonBlank :"]);
            this.indent(() => {
                //let count = e.cases.size;

                this.forEachEnumCase(e, "none", (_, jsonName) => {
                    let strBuild = "";
                    const backticks =
                        shouldAddBacktick(jsonName) ||
                        jsonName.includes(" ") ||
                        !Number.isNaN(Number.parseInt(jsonName.charAt(0)));
                    if (!isBlank(jsonName)) {
                        this.emitItem(["case "]);
                    }

                    if (backticks) {
                        strBuild = strBuild + "`";
                    }

                    strBuild = strBuild + jsonName;
                    if (backticks) {
                        strBuild = strBuild + "`";
                    }

                    //if (--count > 0) strBuild + ",";
                    // don't emit the blank case
                    if (!isBlank(jsonName)) {
                        this.emitLine([strBuild]);
                    }
                });
            });

            this.emitLine([
                "given Decoder[",
                enumName,
                "NonBlank] = Decoder.decodeString.emapTry(x => Try(",
                enumName,
                "NonBlank.valueOf(x) ))",
            ]);
            this.emitLine(
                "given Encoder[",
                enumName,
                "NonBlank] = Encoder.encodeString.contramap(_.toString())",
            );
        } else {
            //console.log("enumName: " + enumName + " has non blank");
            this.emitLine(["enum ", enumName, " : "]);

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

                    //                    if (--count > 0) strBuild + ",";
                    this.emitLine([strBuild]);
                });
            });
            this.emitLine([
                "given Decoder[",
                enumName,
                "] = Decoder.decodeString.emapTry(x => Try(",
                enumName,
                ".valueOf(x) )) ",
            ]);
            this.emitLine([
                "given Encoder[",
                enumName,
                "] = Encoder.encodeString.contramap(_.toString())",
            ]);
            this.ensureBlankLine();
        }
    }

    protected emitHeader(): void {
        super.emitHeader();

        this.emitLine("import scala.util.Try");
        this.emitLine("import io.circe.syntax._");
        this.emitLine("import io.circe._");
        this.emitLine("import cats.syntax.functor._");
        this.ensureBlankLine();

        this.emitLine("// For serialising string unions");
        // this.emitLine(
        //     "given [A <: Singleton](using A <:< String): Decoder[A] = Decoder.decodeString.emapTry(x => Try(x.asInstanceOf[A])) "
        // );
        // this.emitLine(
        //     "given [A <: Singleton](using ev: A <:< String): Encoder[A] = Encoder.encodeString.contramap(ev) "
        // );
        this.ensureBlankLine();
        this.emitLine(
            "// If a union has a null in, then we'll need this too... ",
        );
        this.emitLine("type NullValue = None.type");
    }

    protected emitTopLevelArray(t: ArrayType, name: Name): void {
        super.emitTopLevelArray(t, name);
        const elementType = this.scalaType(t.items);
        this.emitLine([
            "given (using ev : ",
            elementType,
            "): Encoder[Seq[",
            elementType,
            "]] = Encoder.encodeSeq[",
            elementType,
            "]",
        ]);
    }

    protected emitTopLevelMap(t: MapType, name: Name): void {
        super.emitTopLevelMap(t, name);
        const elementType = this.scalaType(t.values);
        this.ensureBlankLine();
        this.emitLine([
            "given (using ev : ",
            elementType,
            "): Encoder[Map[String, ",
            elementType,
            "]] = Encoder.encodeMap[String, ",
            elementType,
            "]",
        ]);
    }

    protected emitUnionDefinition(u: UnionType, unionName: Name): void {
        function sortBy(t: Type): string {
            const kind = t.kind;
            if (kind === "class") return kind;
            return `_${kind}`;
        }

        this.emitDescription(this.descriptionForType(u));

        const [maybeNull, nonNulls] = removeNullFromUnion(u, sortBy);
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

            this.emitLine(["given Decoder[", unionName, "] = {"]);
            this.indent(() => {
                this.emitLine(["List[Decoder[", unionName, "]]("]);
                this.indent(() => {
                    sourceLikeTypes.forEach((t) => {
                        this.emitLine(["Decoder[", t[0], "].widen,"]);
                    });
                });
                this.emitLine(").reduceLeft(_ or _)");
            });
            this.emitLine(["}"]);

            this.ensureBlankLine();

            this.emitLine([
                "given Encoder[",
                unionName,
                "] = Encoder.instance {",
            ]);
            this.indent(() => {
                sourceLikeTypes.forEach((t, i) => {
                    const paramTemp = `enc${i.toString()}`;
                    this.emitLine([
                        "case ",
                        paramTemp,
                        " : ",
                        t[0],
                        " => ",
                        this.circeEncoderForType(t[1], false, false, paramTemp),
                    ]);
                });
            });
            this.emitLine("}");
        }
    }
}
