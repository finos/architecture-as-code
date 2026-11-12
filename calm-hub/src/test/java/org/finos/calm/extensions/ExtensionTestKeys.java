package org.finos.calm.extensions;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.math.BigInteger;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.AlgorithmParameterSpec;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.RSAKeyGenParameterSpec;
import java.security.spec.RSAPrivateCrtKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;

/** Key pairs written as PEM files, so that no test key is committed. */
public final class ExtensionTestKeys {

    /** The PEM files of one key pair. */
    public record KeyFiles(KeyPair pair, Path privateKey, Path publicKey) {}

    private ExtensionTestKeys() {
    }

    public static KeyFiles rsa(Path dir, String name) {
        return write(dir, name, generate("RSA", new RSAKeyGenParameterSpec(2048, RSAKeyGenParameterSpec.F4)));
    }

    /** A 1024-bit RSA key made from two primes, so that no weak key comes from KeyPairGenerator. */
    public static KeyFiles weakRsa(Path dir, String name) {
        SecureRandom random = new SecureRandom();
        BigInteger e = RSAKeyGenParameterSpec.F4;
        BigInteger p;
        BigInteger q;
        BigInteger phi;
        do {
            p = BigInteger.probablePrime(512, random);
            q = BigInteger.probablePrime(512, random);
            phi = p.subtract(BigInteger.ONE).multiply(q.subtract(BigInteger.ONE));
        } while (p.equals(q) || !phi.gcd(e).equals(BigInteger.ONE));
        BigInteger n = p.multiply(q);
        BigInteger d = e.modInverse(phi);
        try {
            KeyFactory factory = KeyFactory.getInstance("RSA");
            PrivateKey privateKey = factory.generatePrivate(new RSAPrivateCrtKeySpec(n, e, d, p, q,
                    d.mod(p.subtract(BigInteger.ONE)), d.mod(q.subtract(BigInteger.ONE)), q.modInverse(p)));
            PublicKey publicKey = factory.generatePublic(new RSAPublicKeySpec(n, e));
            return write(dir, name, new KeyPair(publicKey, privateKey));
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public static KeyFiles ec(Path dir, String name, String curve) {
        return write(dir, name, generate("EC", new ECGenParameterSpec(curve)));
    }

    /** RSA key files in a new temporary folder, for a Quarkus test profile. */
    public static KeyFiles rsaInTempDir() {
        try {
            return rsa(Files.createTempDirectory("calm-hub-keys"), "hub");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static KeyPair generate(String algorithm, AlgorithmParameterSpec spec) {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance(algorithm);
            generator.initialize(spec);
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static KeyFiles write(Path dir, String name, KeyPair pair) {
        try {
            Path privateKey = Files.writeString(dir.resolve(name + "-private.pem"),
                    pem("PRIVATE KEY", pair.getPrivate().getEncoded()));
            Path publicKey = Files.writeString(dir.resolve(name + "-public.pem"),
                    pem("PUBLIC KEY", pair.getPublic().getEncoded()));
            return new KeyFiles(pair, privateKey, publicKey);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public static String pem(String label, byte[] der) {
        return "-----BEGIN " + label + "-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes()).encodeToString(der)
                + "\n-----END " + label + "-----\n";
    }
}
