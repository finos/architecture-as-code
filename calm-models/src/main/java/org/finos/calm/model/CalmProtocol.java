package org.finos.calm.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum CalmProtocol {
    HTTP,
    HTTPS,
    FTP,
    SFTP,
    JDBC,
    @JsonProperty("WebSocket") WEBSOCKET,
    @JsonProperty("SocketIO") SOCKET_IO,
    LDAP,
    AMQP,
    TLS,
    @JsonProperty("mTLS") MTLS,
    TCP
}
