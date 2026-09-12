const service = require('./exports.service');
const { recordAudit } = require('../../middlewares/audit');

function audit(req, format, crisisId) {
  recordAudit({
    actorId: req.user?.id, action: 'EXPORT', entity: 'crisis_export', entityId: crisisId,
    payload: { format }, ip: req.ip,
  });
}

async function html(req, res, next) {
  try {
    const data = await service.gatherCrisisReportData(Number(req.params.id));
    const body = service.buildHtmlReport(data);
    audit(req, 'html', data.crisis.id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="crise-${data.crisis.id}.html"`);
    res.send(body);
  } catch (err) { next(err); }
}

async function pdf(req, res, next) {
  try {
    const data = await service.gatherCrisisReportData(Number(req.params.id));
    const buffer = await service.buildPdfReport(data);
    audit(req, 'pdf', data.crisis.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="crise-${data.crisis.id}.pdf"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

async function docx(req, res, next) {
  try {
    const data = await service.gatherCrisisReportData(Number(req.params.id));
    const buffer = await service.buildDocxReport(data);
    audit(req, 'docx', data.crisis.id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="crise-${data.crisis.id}.docx"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { html, pdf, docx };
