package org.unfpa.otg.sync

import android.content.Context
import java.security.KeyFactory
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import android.util.Base64

/**
 * ManifestVerifier — verifies the Ed25519 signature of an OTA content manifest.
 *
 * The public key is bundled in assets/keys/manifest_public.pem.
 * The private key is held exclusively by UNFPA in GitHub Actions secrets.
 *
 * Any manifest with an invalid or missing signature is silently rejected —
 * the app continues using its existing knowledge base and notifies the admin.
 */
class ManifestVerifier(private val context: Context) {

    companion object {
        const val PUBLIC_KEY_ASSET = "keys/manifest_public.pem"
        private const val PEM_HEADER = "-----BEGIN PUBLIC KEY-----"
        private const val PEM_FOOTER = "-----END PUBLIC KEY-----"
    }

    /**
     * Verify [signature] (Base64-encoded Ed25519 signature) over [manifestJson].
     * Returns true only if the signature is valid and was produced by the UNFPA private key.
     */
    fun verify(manifestJson: String, signature: String): Boolean {
        return try {
            val publicKey = loadPublicKey()
            val signatureBytes = Base64.decode(signature, Base64.DEFAULT)
            val messageBytes = manifestJson.toByteArray(Charsets.UTF_8)

            val sig = Signature.getInstance("Ed25519")
            sig.initVerify(publicKey)
            sig.update(messageBytes)
            sig.verify(signatureBytes)
        } catch (e: Exception) {
            false
        }
    }

    private fun loadPublicKey(): java.security.PublicKey {
        val pem = context.assets.open(PUBLIC_KEY_ASSET)
            .bufferedReader().readText()
        val base64 = pem
            .replace(PEM_HEADER, "")
            .replace(PEM_FOOTER, "")
            .replace("\\s".toRegex(), "")
        val keyBytes = Base64.decode(base64, Base64.DEFAULT)
        val spec = X509EncodedKeySpec(keyBytes)
        return KeyFactory.getInstance("Ed25519").generatePublic(spec)
    }
}
