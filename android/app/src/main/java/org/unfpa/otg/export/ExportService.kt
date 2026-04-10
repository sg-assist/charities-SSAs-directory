package org.unfpa.otg.export

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.apache.poi.xwpf.usermodel.ParagraphAlignment
import org.apache.poi.xwpf.usermodel.XWPFDocument
import com.itextpdf.kernel.pdf.PdfDocument
import com.itextpdf.kernel.pdf.PdfWriter
import com.itextpdf.layout.Document
import com.itextpdf.layout.element.Paragraph
import com.itextpdf.layout.element.Text
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * ExportService — generates DOCX (Apache POI) and PDF (iText7) exports
 * of conversation transcripts including source citations.
 *
 * Port of next-app/services/exportService.ts.
 */
class ExportService(private val context: Context) {

    data class ExportMessage(
        val role: String,       // "user" | "assistant"
        val content: String,
        val sources: List<String> = emptyList(),
    )

    data class ExportResult(val uri: Uri, val mimeType: String)

    suspend fun exportDocx(
        messages: List<ExportMessage>,
        mode: String,
        country: String,
    ): ExportResult = withContext(Dispatchers.IO) {
        val doc = XWPFDocument()

        // Title
        val titlePara = doc.createParagraph()
        titlePara.alignment = ParagraphAlignment.CENTER
        val titleRun = titlePara.createRun()
        titleRun.isBold = true
        titleRun.fontSize = 16
        titleRun.setText("UNFPA On-The-Ground — Conversation Export")

        // Metadata
        val metaPara = doc.createParagraph()
        val metaRun = metaPara.createRun()
        metaRun.fontSize = 10
        metaRun.color = "888888"
        metaRun.setText("Mode: ${mode.replaceFirstChar { it.uppercase() }}  |  Country: ${country.uppercase()}  |  " +
                "Exported: ${SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date())}")

        // Disclaimer
        val disclaimerPara = doc.createParagraph()
        val disclaimerRun = disclaimerPara.createRun()
        disclaimerRun.fontSize = 9
        disclaimerRun.isItalic = true
        disclaimerRun.setText("Reference only — not a substitute for clinical judgment. " +
                "Verify all clinical information with qualified personnel.")

        doc.createParagraph() // spacer

        // Messages
        for (message in messages) {
            val rolePara = doc.createParagraph()
            val roleRun = rolePara.createRun()
            roleRun.isBold = true
            roleRun.fontSize = 11
            roleRun.setText(if (message.role == "user") "Question:" else "Answer:")

            val contentPara = doc.createParagraph()
            val contentRun = contentPara.createRun()
            contentRun.fontSize = 11
            // Strip [SRC:...] tags for plain text export
            contentRun.setText(message.content.replace(Regex("""\[SRC:[^\]]+]"""), "").trim())

            if (message.sources.isNotEmpty()) {
                val sourcesPara = doc.createParagraph()
                val sourcesRun = sourcesPara.createRun()
                sourcesRun.fontSize = 9
                sourcesRun.isItalic = true
                sourcesRun.color = "555555"
                sourcesRun.setText("Sources: ${message.sources.joinToString("; ")}")
            }

            doc.createParagraph() // spacer
        }

        val file = File(context.cacheDir, "otg_export_${System.currentTimeMillis()}.docx")
        FileOutputStream(file).use { doc.write(it) }

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        ExportResult(uri, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }

    suspend fun exportPdf(
        messages: List<ExportMessage>,
        mode: String,
        country: String,
    ): ExportResult = withContext(Dispatchers.IO) {
        val file = File(context.cacheDir, "otg_export_${System.currentTimeMillis()}.pdf")
        val writer = PdfWriter(FileOutputStream(file))
        val pdfDoc = PdfDocument(writer)
        val doc = Document(pdfDoc)

        // Title
        doc.add(
            Paragraph("UNFPA On-The-Ground — Conversation Export")
                .setFontSize(16f)
                .setBold()
        )

        // Metadata
        doc.add(
            Paragraph("Mode: ${mode.replaceFirstChar { it.uppercase() }}  |  " +
                    "Country: ${country.uppercase()}  |  " +
                    "Exported: ${SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(Date())}")
                .setFontSize(9f)
        )

        // Disclaimer
        doc.add(
            Paragraph("Reference only — not a substitute for clinical judgment. " +
                    "Verify all clinical information with qualified personnel.")
                .setFontSize(8f)
                .setItalic()
        )

        doc.add(Paragraph(" "))

        // Messages
        for (message in messages) {
            val roleLabel = if (message.role == "user") "Question:" else "Answer:"
            doc.add(Paragraph(roleLabel).setFontSize(11f).setBold())

            val cleanContent = message.content.replace(Regex("""\[SRC:[^\]]+]"""), "").trim()
            doc.add(Paragraph(cleanContent).setFontSize(11f))

            if (message.sources.isNotEmpty()) {
                doc.add(
                    Paragraph("Sources: ${message.sources.joinToString("; ")}")
                        .setFontSize(8f)
                        .setItalic()
                )
            }
            doc.add(Paragraph(" "))
        }

        doc.close()

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        ExportResult(uri, "application/pdf")
    }

    fun shareExport(result: ExportResult) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = result.mimeType
            putExtra(Intent.EXTRA_STREAM, result.uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Export").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
    }
}
