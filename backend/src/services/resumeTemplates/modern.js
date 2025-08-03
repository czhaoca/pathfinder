const PDFDocument = require('pdfkit');
const { Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } = require('docx');

module.exports = {
  name: 'Modern',
  description: 'Contemporary design with clean lines and modern typography',
  preview: '/templates/modern-preview.png',

  /**
   * Apply PDF styling for modern template
   */
  applyPDFStyling(doc, resumeData) {
    const { personal, experiences, skills, education, achievements, certifications } = resumeData;
    
    // Color scheme - modern and vibrant
    const colors = {
      primary: '#1A1A2E',
      secondary: '#16213E',
      accent: '#E94560',
      text: '#333333',
      light: '#94A3B8',
      background: '#F7F7F7'
    };

    // Create sidebar background
    doc.rect(0, 0, 200, doc.page.height)
       .fillColor(colors.background)
       .fill();

    // Name in sidebar
    doc.fontSize(28)
       .fillColor(colors.primary)
       .text(personal.name, 20, 40, {
         width: 160,
         align: 'left'
       });

    // Contact info in sidebar
    doc.fontSize(9)
       .fillColor(colors.text)
       .moveDown(1);

    const contactItems = [
      { label: 'Email', value: personal.email },
      { label: 'Phone', value: personal.phone },
      { label: 'Location', value: personal.location },
      { label: 'LinkedIn', value: personal.linkedIn },
      { label: 'Website', value: personal.website }
    ];

    let currentY = doc.y;
    contactItems.forEach(item => {
      if (item.value) {
        doc.fontSize(8)
           .fillColor(colors.light)
           .text(item.label.toUpperCase(), 20, currentY, { width: 160 });
        doc.fontSize(9)
           .fillColor(colors.text)
           .text(item.value, 20, currentY + 12, { width: 160 });
        currentY += 30;
      }
    });

    // Skills in sidebar
    if (skills.length > 0) {
      currentY += 20;
      doc.fontSize(11)
         .fillColor(colors.accent)
         .font('Helvetica-Bold')
         .text('SKILLS', 20, currentY);
      
      currentY += 20;
      skills.forEach(category => {
        doc.fontSize(9)
           .fillColor(colors.secondary)
           .font('Helvetica-Bold')
           .text(category.category, 20, currentY, { width: 160 });
        
        currentY += 15;
        const skillsText = category.skills.join(' • ');
        doc.fontSize(8)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(skillsText, 20, currentY, { 
             width: 160,
             align: 'justify'
           });
        currentY = doc.y + 15;
      });
    }

    // Main content area starts at x=220
    const mainX = 220;
    const mainWidth = doc.page.width - mainX - 50;
    let mainY = 40;

    // Professional Summary in main area
    if (personal.summary) {
      doc.fontSize(11)
         .fillColor(colors.accent)
         .font('Helvetica-Bold')
         .text('PROFESSIONAL SUMMARY', mainX, mainY, { width: mainWidth });
      
      mainY += 20;
      doc.fontSize(10)
         .fillColor(colors.text)
         .font('Helvetica')
         .text(personal.summary, mainX, mainY, {
           width: mainWidth,
           align: 'justify',
           lineGap: 3
         });
      mainY = doc.y + 20;
    }

    // Experience in main area
    if (experiences.length > 0) {
      doc.fontSize(11)
         .fillColor(colors.accent)
         .font('Helvetica-Bold')
         .text('EXPERIENCE', mainX, mainY, { width: mainWidth });
      
      mainY += 20;
      experiences.forEach((exp, index) => {
        if (index > 0) mainY += 15;
        
        // Timeline dot
        doc.circle(mainX - 10, mainY + 5, 3)
           .fillColor(colors.accent)
           .fill();
        
        // Job details
        doc.fontSize(11)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(exp.title, mainX, mainY, { width: mainWidth });
        
        doc.fontSize(9)
           .fillColor(colors.secondary)
           .font('Helvetica')
           .text(`${exp.company} | ${exp.location || ''} | ${exp.startDate} - ${exp.endDate}`, 
                 mainX, doc.y + 2, { width: mainWidth });
        
        mainY = doc.y + 10;
        
        // Bullets with custom style
        exp.bullets.forEach(bullet => {
          doc.fontSize(9)
             .fillColor(colors.text)
             .text(`▸ ${bullet}`, mainX + 10, mainY, {
               width: mainWidth - 10,
               align: 'justify',
               lineGap: 2
             });
          mainY = doc.y + 5;
        });
      });
    }

    // Education in main area
    if (education.length > 0) {
      mainY += 20;
      doc.fontSize(11)
         .fillColor(colors.accent)
         .font('Helvetica-Bold')
         .text('EDUCATION', mainX, mainY, { width: mainWidth });
      
      mainY += 20;
      education.forEach((edu, index) => {
        if (index > 0) mainY += 15;
        
        doc.fontSize(10)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text(edu.degree, mainX, mainY, { width: mainWidth });
        
        doc.fontSize(9)
           .fillColor(colors.secondary)
           .font('Helvetica')
           .text(`${edu.institution} | ${this.formatDate(edu.startDate)} - ${this.formatDate(edu.endDate)}`, 
                 mainX, doc.y + 2, { width: mainWidth });
        
        if (edu.field) {
          doc.fontSize(9)
             .fillColor(colors.text)
             .text(edu.field, mainX, doc.y + 2, { width: mainWidth });
        }
        
        mainY = doc.y + 5;
      });
    }

    // Certifications at bottom of sidebar
    if (certifications.length > 0) {
      const certY = doc.page.height - 150;
      doc.fontSize(11)
         .fillColor(colors.accent)
         .font('Helvetica-Bold')
         .text('CERTIFICATIONS', 20, certY);
      
      let certCurrentY = certY + 20;
      certifications.forEach(cert => {
        doc.fontSize(8)
           .fillColor(colors.text)
           .font('Helvetica')
           .text(`• ${cert.name}`, 20, certCurrentY, { width: 160 });
        certCurrentY += 12;
      });
    }
  },

  /**
   * Generate DOCX content for modern template
   */
  generateDOCXContent(resumeData) {
    const { personal, experiences, skills, education, achievements, certifications } = resumeData;
    const content = [];

    // Modern header with accent color
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: personal.name,
            bold: true,
            size: 36,
            color: '1A1A2E'
          })
        ],
        spacing: { after: 120 }
      })
    );

    // Contact info with separators
    const contactParts = [
      personal.email,
      personal.phone,
      personal.location
    ].filter(Boolean);

    content.push(
      new Paragraph({
        children: contactParts.map((part, index) => [
          new TextRun({
            text: part,
            size: 20,
            color: '333333'
          }),
          index < contactParts.length - 1 ? new TextRun({
            text: ' | ',
            size: 20,
            color: 'E94560'
          }) : null
        ]).flat().filter(Boolean),
        spacing: { after: 240 }
      })
    );

    // Professional Summary with modern styling
    if (personal.summary) {
      content.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PROFESSIONAL SUMMARY',
              bold: true,
              size: 24,
              color: 'E94560'
            })
          ],
          spacing: { before: 240, after: 120 },
          border: {
            bottom: {
              color: 'E94560',
              space: 1,
              value: BorderStyle.SINGLE,
              size: 6
            }
          }
        }),
        new Paragraph({
          text: personal.summary,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 240 }
        })
      );
    }

    // Add remaining sections with modern styling
    // ... (similar to professional template but with modern colors and formatting)

    return content;
  },

  /**
   * Helper methods
   */
  formatDate(dateString) {
    if (!dateString || dateString === 'Present') return dateString;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
};