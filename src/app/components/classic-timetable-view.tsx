"use client";

import timetableData from "@/app/data/timetable.json";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";

type TimetableEntry = {
  id: string;
  fach: string;
  lehrer?: string;
  start: string;
  ende: string;
  hauptfach?: boolean;
};

type Timetable = {
  [day: string]: TimetableEntry[];
};

const timetable: Timetable = timetableData;
const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
const timeSlots = [
  "08:00 - 08:45",
  "08:45 - 09:30",
  "09:45 - 10:30",
  "10:30 - 11:15",
  "11:30 - 12:15",
  "12:15 - 13:00",
];

const getEntry = (day: string, timeSlot: string) => {
  const daySchedule = timetable[day];
  if (!daySchedule) return null;

  const [start] = timeSlot.split(" - ");
  return daySchedule.find(
    (entry) => entry.start === start && entry.fach !== "Pause"
  );
};

export default function ClassicTimetableView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wochenübersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="border">
          <TableHeader>
            <TableRow>
              <TableHead className="border-r">Stunde</TableHead>
              {days.map((day) => (
                <TableHead key={day} className="text-center border-r">
                  {day}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeSlots.map((slot, index) => (
              <TableRow key={slot}>
                <TableCell className="font-medium border-r">
                  <div className="flex flex-col">
                    <span>{index + 1}. Stunde</span>
                    <span className="text-xs text-muted-foreground">{slot}</span>
                  </div>
                </TableCell>
                {days.map((day) => {
                  const entry = getEntry(day, slot);
                  return (
                    <TableCell key={`${day}-${slot}`} className="text-center border-r">
                      {entry ? (
                        <div>
                          <p className="font-bold">{entry.fach}</p>
                          {entry.lehrer && (
                            <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                              <User className="w-3 h-3" />
                              <span>{entry.lehrer}</span>
                            </div>
                          )}
                          {entry.hauptfach && (
                             <Badge variant="default" className="mt-1">Hauptfach</Badge>
                          )}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
