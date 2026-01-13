const Report = require("../models/report.model");

async function createReport(req, res) {
    const { reportedBy, reportedAgainst, reason, proof, status } = req.body;
    if (!reportedBy || !reportedAgainst || !reason || !proof) {
        return res
            .status(400)
            .json({ message: "All fields are required to post a report!" });
    }
    try {
        const newReport = await Report.create({
            reportedBy : req.params.consumerId,
            reportedAgainst : req.params.artistId,
            reason,
            proof,
            status: "pending"
        });
        if (!newReport) {
            return res.status(400).json({ message: "Failed to create report" });
        }
        res.status(201).json(newReport);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
}

module.exports = {
    createReport,
};