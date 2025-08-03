const PDFDocument = require('pdfkit');
const { Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');

module.exports = {
  name: 'Professional',
  description: 'Clean and traditional resume template suitable for most industries',
  preview: '/templates/professional-preview.png',

  /**
   * Apply PDF styling for professional template
   */
  applyPDFStyling(doc, resumeData) {
    const { personal, experiences, skills, education, achievements, certifications } = resumeData;
    
    // Color scheme
    const colors = {
      primary: '#2C3E50',
      secondary: '#34495E',
      accent: '#3498DB',
      text: '#2C3E50',
      light: '#7F8C8D'
    };

    // Header with name and contact
    doc.fontSize(24)
       .fillColor(colors.primary)
       .text(personal.name, { align: 'center' });
    
    doc.fontSize(10)
       .fillColor(colors.light)
       .moveDown(0.5);
    
    const contactLine = [
      personal.email,
      personal.phone,
      personal.location
    ].filter(Boolean).join(' • ');
    
    doc.text(contactLine, { align: 'center' });
    
    if (personal.linkedIn || personal.website) {
      const links = [personal.linkedIn, personal.website].filter(Boolean).join(' • ');
      doc.text(links, { align: 'center' });
    }
    
    // Professional Summary
    if (personal.summary) {
      this.addSection(doc, 'PROFESSIONAL SUMMARY', colors);
      doc.fontSize(10)
         .fillColor(colors.text)
         .text(personal.summary, {
           align: 'justify',
           indent: 0,
           lineGap: 2
         });
    }

    // Experience Section
    if (experiences.length > 0) {
      this.addSection(doc, 'PROFESSIONAL EXPERIENCE', colors);
      
      experiences.forEach((exp, index) => {
        if (index > 0) doc.moveDown(0.5);
        
        // Job title and company
        doc.fontSize(11)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(exp.title, { continued: true })
           .font('Helvetica')
           .fillColor(colors.light)
           .text(` | ${exp.company}`, { continued: true })
           .text(` | ${exp.startDate} - ${exp.endDate}`, { align: 'right' });
        
        if (exp.location) {
          doc.fontSize(9)
             .fillColor(colors.light)
             .text(exp.location);
        }
        
        // Bullet points
        doc.fontSize(10)
           .fillColor(colors.text);
        
        exp.bullets.forEach(bullet => {
          doc.text(`• ${bullet}`, {
            indent: 10,
            align: 'justify',
            lineGap: 1
          });
        });
      });
    }

    // Skills Section
    if (skills.length > 0) {
      this.addSection(doc, 'SKILLS', colors);
      
      skills.forEach(category => {
        doc.fontSize(10)
           .fillColor(colors.secondary)
           .font('Helvetica-Bold')
           .text(`${category.category}: `, { continued: true })
           .font('Helvetica')
           .fillColor(colors.text)
           .text(category.skills.join(', '));
        doc.moveDown(0.3);
      });
    }

    // Education Section
    if (education.length > 0) {
      this.addSection(doc, 'EDUCATION', colors);
      
      education.forEach((edu, index) => {
        if (index > 0) doc.moveDown(0.5);
        
        doc.fontSize(11)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(edu.degree, { continued: true })
           .font('Helvetica')
           .fillColor(colors.light)
           .text(` | ${edu.institution}`, { continued: true })
           .text(` | ${this.formatDate(edu.startDate)} - ${this.formatDate(edu.endDate)}`, { align: 'right' });
        
        if (edu.field) {
          doc.fontSize(10)
             .fillColor(colors.text)
             .text(edu.field);
        }
        
        if (edu.gpa) {
          doc.text(`GPA: ${edu.gpa}`);
        }
        
        if (edu.honors && edu.honors.length > 0) {
          doc.text(`Honors: ${edu.honors.join(', ')}`);
        }
      });
    }

    // Achievements Section
    if (achievements.length > 0) {
      this.addSection(doc, 'KEY ACHIEVEMENTS', colors);
      
      achievements.forEach(achievement => {
        doc.fontSize(10)
           .fillColor(colors.text)
           .text(`• ${achievement}`, {
             indent: 10,
             align: 'justify'
           });
      });
    }

    // Certifications Section
    if (certifications.length > 0) {
      this.addSection(doc, 'CERTIFICATIONS', colors);
      
      certifications.forEach(cert => {
        doc.fontSize(10)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(cert.name, { continued: true })
           .font('Helvetica')
           .fillColor(colors.light)
           .text(` | ${cert.issuer} | ${this.formatDate(cert.date)}`);
      });
    }
  },

  /**
   * Generate DOCX content for professional template
   */
  generateDOCXContent(resumeData) {
    const { personal, experiences, skills, education, achievements, certifications } = resumeData;
    const content = [];

    // Header
    content.push(
      new Paragraph({
        text: personal.name,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 }
      })
    );

    // Contact info
    const contactInfo = [
      personal.email,
      personal.phone,
      personal.location,
      personal.linkedIn,
      personal.website
    ].filter(Boolean).join(' | ');

    content.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: contactInfo,
            size: 20,
            color: '7F8C8D'
          })
        ],
        spacing: { after: 240 }
      })
    );

    // Professional Summary
    if (personal.summary) {
      content.push(
        new Paragraph({
          text: 'PROFESSIONAL SUMMARY',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 }
        }),
        new Paragraph({
          text: personal.summary,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 240 }
        })
      );
    }

    // Experience
    if (experiences.length > 0) {
      content.push(
        new Paragraph({
          text: 'PROFESSIONAL EXPERIENCE',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 }
        })
      );

      experiences.forEach(exp => {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: exp.title,
                bold: true,
                size: 24
              }),
              new TextRun({
                text: ` | ${exp.company} | ${exp.startDate} - ${exp.endDate}`,
                size: 22,
                color: '7F8C8D'
              })
            ],
            spacing: { before: 120, after: 60 }
          })
        );

        if (exp.location) {
          content.push(
            new Paragraph({
              text: exp.location,
              size: 20,
              color: '7F8C8D',
              spacing: { after: 60 }
            })
          );
        }

        exp.bullets.forEach(bullet => {
          content.push(
            new Paragraph({
              text: `• ${bullet}`,
              spacing: { left: 400, after: 60 }
            })
          );
        });
      });
    }

    // Skills
    if (skills.length > 0) {
      content.push(
        new Paragraph({
          text: 'SKILLS',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 }
        })
      );

      skills.forEach(category => {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${category.category}: `,
                bold: true
              }),
              new TextRun({
                text: category.skills.join(', ')
              })
            ],
            spacing: { after: 60 }
          })
        );
      });
    }

    // Education
    if (education.length > 0) {
      content.push(
        new Paragraph({
          text: 'EDUCATION',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 }
        })
      );

      education.forEach(edu => {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: edu.degree,
                bold: true,
                size: 24
              }),
              new TextRun({
                text: ` | ${edu.institution} | ${this.formatDate(edu.startDate)} - ${this.formatDate(edu.endDate)}`,
                size: 22,
                color: '7F8C8D'
              })
            ],
            spacing: { before: 120, after: 60 }
          })
        );

        if (edu.field) {
          content.push(
            new Paragraph({
              text: edu.field,
              spacing: { after: 60 }
            })
          );
        }
      });
    }

    return content;
  },

  /**
   * Helper methods
   */
  addSection(doc, title, colors) {
    doc.moveDown()
       .fontSize(12)
       .fillColor(colors.accent)
       .font('Helvetica-Bold')
       .text(title)
       .moveTo(doc.x, doc.y)
       .lineTo(doc.page.width - doc.page.margins.right, doc.y)
       .strokeColor(colors.accent)
       .lineWidth(1)
       .stroke()
       .moveDown(0.5)
       .font('Helvetica')
       .fillColor(colors.text);
  },

  formatDate(dateString) {
    if (!dateString || dateString === 'Present') return dateString;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
};