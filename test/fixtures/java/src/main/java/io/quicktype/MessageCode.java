package io.quicktype;

import java.io.IOException;
import com.fasterxml.jackson.annotation.*;

public class MessageCode {
    private Code code;

    @JsonProperty("code")
    public Code getCode() {
        return code;
    }

    @JsonProperty("code")
    public void setCode(Code value) {
        this.code = value;
    }

    public enum Code {
        MULTI_SPA_IN_GROUP_REJECTED, SOME_OTHER_VALUE;

        @JsonValue
        public String toValue() {
            switch (this) {
                case MULTI_SPA_IN_GROUP_REJECTED:
                    return "MULTI_SPA_IN_GROUP_REJECTED";
                case SOME_OTHER_VALUE:
                    return "SOME_OTHER_VALUE";
            }
            return null;
        }

        @JsonCreator
        public static Code forValue(String value) throws IOException {
            if (value.equals("MULTI_SPA_IN_GROUP_REJECTED"))
                return MULTI_SPA_IN_GROUP_REJECTED;
            if (value.equals("SOME_OTHER_VALUE"))
                return SOME_OTHER_VALUE;
            throw new IOException("Cannot deserialize Code");
        }
    }
}
